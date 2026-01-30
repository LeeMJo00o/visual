import asyncio
import json
import math
import time
import uuid
from typing import Any

from chain_http import aio_http
from chain_model.model import StdRes
from fastapi import APIRouter, Body

from src.core.config import (
    pp_visual_TASK_EXECUTOR_URL,
    pp_visual_TASK_INFO_URL,
    pp_visual_PATH_PLAN_URL,
)
from src.core.log import logger
from src.map_tools import g_roads
from src.middlewares.redis_handler.connect import redis_cli, redis_cli_fms
from src.routing import normalize_angle

router = APIRouter()

BUSINESS_KEY_CACHE_PREFIX = "pp_visual:manual_path:business_key:"


def _decode_redis_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            return value
    return value


def _parse_business_key(payload: Any, vehicle_id: str) -> str | None:
    if payload is None:
        return None
    if isinstance(payload, (str, int)):
        return str(payload)
    if isinstance(payload, bytes):
        try:
            return payload.decode("utf-8")
        except Exception:
            return None
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            return None

    if isinstance(payload, dict):
        if vehicle_id in payload:
            vehicle_payload = payload.get(vehicle_id)
            if isinstance(vehicle_payload, dict):
                return vehicle_payload.get("business_key") or vehicle_payload.get("businessKey")
        return payload.get("business_key") or payload.get("businessKey")

    if isinstance(payload, list):
        for item in payload:
            if not isinstance(item, dict):
                continue
            if item.get("vehicle_id") == vehicle_id or item.get("vehicleID") == vehicle_id:
                return item.get("business_key") or item.get("businessKey")
    return None


def _extract_target_from_plan(plan_data: Any, fallback: dict) -> dict:
    if isinstance(plan_data, dict):
        for key in ("target", "point", "points", "pose", "result"):
            target = plan_data.get(key)
            if isinstance(target, dict) and {"x", "y", "heading"}.issubset(target.keys()):
                return {
                    "x": float(target["x"]),
                    "y": float(target["y"]),
                    "heading": float(target["heading"]),
                }
        data = plan_data.get("data")
        if isinstance(data, dict) and {"x", "y", "heading"}.issubset(data.keys()):
            return {
                "x": float(data["x"]),
                "y": float(data["y"]),
                "heading": float(data["heading"]),
            }
    return fallback


def _is_plan_success(plan_data: Any, status_code: int) -> bool:
    if isinstance(plan_data, dict):
        code = plan_data.get("code")
        if isinstance(code, int):
            return code == 200
    return status_code == 200


def _extract_task_id(plan_data: Any) -> str | None:
    if not isinstance(plan_data, dict):
        return None
    task_id = plan_data.get("task_id")
    if task_id:
        return str(task_id)
    raw = plan_data.get("raw")
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            task_id = parsed.get("task_id")
            if task_id:
                return str(task_id)
        except Exception:
            return None
    return None


def _extract_response_task_id(payload: Any) -> str | None:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            return None
    if not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if isinstance(data, dict):
        task_id = data.get("task_id")
        if task_id:
            return str(task_id)
    return None


async def _await_path_response_task_id(vehicle_id: str, task_id: str, timeout_s: float = 5.0) -> bool:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            raw = await redis_cli.hget("scenario:long_path:response", vehicle_id)
            raw = _decode_redis_value(raw)
            response_task_id = _extract_response_task_id(raw)
            if response_task_id == task_id:
                return True
        except Exception as exc:
            logger.error(f"manual_path plan: read long_path response failed: {exc}")
            return False
        await asyncio.sleep(0.2)
    return False


def _build_start_pose(pose: dict | None) -> dict:
    if not pose:
        return {
            "x": 0.0,
            "y": 0.0,
            "heading": 0.0,
            "trailer_x": 0.0,
            "trailer_y": 0.0,
            "trailer_heading": 0.0,
        }

    heading = pose.get("heading")
    if heading is None:
        heading = pose.get("yaw")
    if heading is None:
        heading = pose.get("theta", 0.0)

    trailer_heading = pose.get("trailer_heading")
    if trailer_heading is None:
        trailer_heading = pose.get("t_theta", heading)

    trailer_x = pose.get("trailer_x")
    if trailer_x is None:
        trailer_x = pose.get("tx", pose.get("x", 0.0))

    trailer_y = pose.get("trailer_y")
    if trailer_y is None:
        trailer_y = pose.get("ty", pose.get("y", 0.0))

    return {
        "x": float(pose.get("x", 0.0)),
        "y": float(pose.get("y", 0.0)),
        "heading": float(heading),
        "trailer_x": float(trailer_x),
        "trailer_y": float(trailer_y),
        "trailer_heading": float(trailer_heading),
    }


def _project_point_to_segment(
    point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]
) -> tuple[float, float, float]:
    px, py = point
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return x1, y1, 0.0
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    dist = math.hypot(px - proj_x, py - proj_y)
    return proj_x, proj_y, dist


def _snap_heading_to_lane(point: dict) -> float | None:
    if not g_roads or not getattr(g_roads, "road_info", None):
        return None

    x = point.get("x")
    y = point.get("y")
    if x is None or y is None:
        return None

    try:
        x = float(x)
        y = float(y)
    except (TypeError, ValueError):
        return None

    raw_heading = point.get("heading")
    try:
        requested_heading = float(raw_heading) if raw_heading is not None else None
    except (TypeError, ValueError):
        requested_heading = None

    nearest_heading = None
    best_distance = float("inf")

    for lane_id, lane_info in g_roads.road_info.items():
        if str(lane_id).startswith("junction_"):
            continue
        line = lane_info.get("points") or []
        if len(line) < 2:
            continue

        for idx in range(len(line) - 1):
            x1, y1 = line[idx]
            x2, y2 = line[idx + 1]
            _, _, dist = _project_point_to_segment((x, y), (x1, y1), (x2, y2))
            if dist < best_distance:
                best_distance = dist
                nearest_heading = math.atan2(y2 - y1, x2 - x1)

    if nearest_heading is None:
        return None

    if requested_heading is None:
        return nearest_heading

    opposite_heading = normalize_angle(nearest_heading + math.pi)
    direct_diff = abs(normalize_angle(requested_heading - nearest_heading))
    opposite_diff = abs(normalize_angle(requested_heading - opposite_heading))
    if opposite_diff < direct_diff:
        return opposite_heading
    return nearest_heading


def _build_routing_payload(req: dict, vehicle_id: str, start_pose: dict, end_pose: dict) -> dict:
    task_type = req.get("task_type", "ESTOP")
    return {
        "device_id": req.get("device_id", vehicle_id),
        "trans_id": req.get("trans_id", str(uuid.uuid4())),
        "task_id": req.get("task_id", str(uuid.uuid4())),
        "timestamp": req.get("timestamp", int(time.time() * 1000)),
        "device_type": req.get("device_type", 3),
        "traj_type": req.get("traj_type", "points"),
        "task_type": task_type,
        "start_pose": req.get("start_pose", start_pose),
        "end_pose": req.get("end_pose", end_pose),
        "passing_location": req.get("passing_location", []),
        "vessel_info": req.get("vessel_info", {}),
        "block_id": req.get("block_id", ""),
        "stack_id": req.get("stack_id", ""),
        "force_overtake": req.get("force_overtake", 0),
        "force_overtake_for_gui": req.get("force_overtake_for_gui", 0),
        "action": req.get("action", 0),
        "tos_change_lane": req.get("tos_change_lane", False),
        "tos_lane_change": req.get("tos_lane_change", {}),
        "via": req.get("via", 0),
        "version": req.get("version", 2),
        "reverse": req.get("reverse", 0),
        "self_overtake": req.get("self_overtake", {"status": True, "obj_lane_id": "", "description": ""}),
        "vehicle_status": req.get("vehicle_status", task_type),
    }


@router.post("/enter")
async def enter_manual_path(req: dict = Body()) -> StdRes:
    vehicle_id = req.get("vehicle_id")
    origin = req.get("origin", "GUI")
    logger.info(f"manual_path enter request: {req}")
    if not vehicle_id:
        return StdRes(data={"ok": False, "message": "vehicle_id is required"})

    business_key = None
    if redis_cli_fms:
        try:
            raw = await redis_cli_fms.hget("self:current_job", vehicle_id)
            payload = _decode_redis_value(raw)
            business_key = _parse_business_key(payload, vehicle_id)
        except Exception as exc:
            logger.error(f"manual_path enter: read business_key failed: {exc}")

    if business_key:
        await redis_cli.set(f"{BUSINESS_KEY_CACHE_PREFIX}{vehicle_id}", business_key, ex=3600)

    abort_url = f"{pp_visual_TASK_EXECUTOR_URL.rstrip('/')}/message_event/abort"
    try:
        logger.info(f"manual_path enter abort request: url={abort_url}, vehicle_id={vehicle_id}, origin={origin}")
        await aio_http.post(
            abort_url,
            params={"vehicle_id": vehicle_id},
            json={"origin": origin},
            timeout=5,
        )
    except Exception as exc:
        logger.error(f"manual_path enter: abort failed: {exc}")
        return StdRes(data={"ok": False, "message": "abort failed", "business_key": business_key})

    logger.info(f"manual_path enter response: ok=True, business_key={business_key}")
    return StdRes(data={"ok": True, "business_key": business_key})


@router.post("/plan")
async def plan_manual_path(req: dict = Body()) -> StdRes:
    vehicle_id = req.get("vehicle_id")
    points = req.get("points") or req.get("point")
    logger.info(f"manual_path plan request: {req}")
    if not vehicle_id or not points:
        return StdRes(data={"ok": False, "message": "vehicle_id and points are required"})

    pose = None
    try:
        raw_pose = await redis_cli.hget("pp4:vehicle:pose", vehicle_id)
        raw_pose = _decode_redis_value(raw_pose)
        if isinstance(raw_pose, str):
            pose = json.loads(raw_pose)
        elif isinstance(raw_pose, dict):
            pose = raw_pose
    except Exception as exc:
        logger.error(f"manual_path plan: read pose failed: {exc}")

    start_pose = _build_start_pose(pose)
    snapped_heading = _snap_heading_to_lane(points)
    end_pose = {
        "x": float(points["x"]),
        "y": float(points["y"]),
        "heading": float(snapped_heading if snapped_heading is not None else points["heading"]),
    }
    payload = _build_routing_payload(req, vehicle_id, start_pose, end_pose)

    plan_url = pp_visual_PATH_PLAN_URL.rstrip("/")
    logger.info(f"manual_path plan forwarding: url={plan_url}, payload={payload}")
    res = await aio_http.post(
        plan_url,
        json=payload,
        timeout=10,
    )
    try:
        json_attr = getattr(res, "json", None)
        if callable(json_attr):
            payload = await json_attr()
        else:
            payload = json_attr
    except Exception:
        text_attr = getattr(res, "text", None)
        if callable(text_attr):
            raw = await text_attr()
        else:
            raw = text_attr
        payload = {"raw": raw}

    target = _extract_target_from_plan(payload, points)
    ok = _is_plan_success(payload, res.status)
    task_id = _extract_task_id(payload)
    if ok and task_id:
        ok = await _await_path_response_task_id(vehicle_id, task_id, timeout_s=5.0)
    logger.info(
        f"manual_path plan response: status={res.status}, ok={ok}, task_id={task_id}, payload={payload}"
    )
    return StdRes(data={"ok": ok, "target": target, "plan": payload})


@router.post("/start")
async def start_manual_path(req: dict = Body()) -> StdRes:
    vehicle_id = req.get("vehicle_id")
    points = req.get("points")
    logger.info(f"manual_path start request: {req}")
    if not vehicle_id or not points:
        return StdRes(data={"ok": False, "message": "vehicle_id and points are required"})

    message_id = int(time.time() * 1000)
    payload = {
        "vehicleID": vehicle_id,
        "messageName": req.get("messageName", "VehicleOrder"),
        "messageUniqueId": req.get("messageUniqueId", message_id),
        "messageTimestamp": req.get("messageTimestamp", time.strftime("%Y-%m-%d %H:%M:%S")),
        "uniqueOrderID": req.get("uniqueOrderID", message_id),
        "origin": req.get("origin", "GUI"),
        "jobType": req.get("jobType", "MOVE"),
        "movementType": req.get("movementType", ""),
        "plannedContainerDestinationList": req.get(
            "plannedContainerDestinationList", [{"containerNum": "", "containerISO": ""}]
        ),
        "destination": req.get(
            "destination",
            {"logicalLocation": {"area": "POINT", "block": "", "lane": "", "stack": "01"}},
        ),
        "points": points,
    }

    start_url = f"{pp_visual_TASK_EXECUTOR_URL.rstrip('/')}/message_event/start"
    logger.info(f"manual_path start forwarding: url={start_url}, payload={payload}")
    res = await aio_http.post(start_url, json=payload, timeout=10)
    try:
        json_attr = getattr(res, "json", None)
        if callable(json_attr):
            data = await json_attr()
        else:
            data = json_attr
    except Exception:
        text_attr = getattr(res, "text", None)
        if callable(text_attr):
            raw = await text_attr()
        else:
            raw = text_attr
        data = {"raw": raw}
    logger.info(f"manual_path start response: status={res.status}, payload={data}")
    return StdRes(data={"ok": res.status == 200, "result": data})


@router.post("/exit")
async def exit_manual_path(req: dict = Body()) -> StdRes:
    vehicle_id = req.get("vehicle_id")
    logger.info(f"manual_path exit request: {req}")
    if not vehicle_id:
        return StdRes(data={"ok": False, "message": "vehicle_id is required"})

    business_key = await redis_cli.get(f"{BUSINESS_KEY_CACHE_PREFIX}{vehicle_id}")
    business_key = _decode_redis_value(business_key)
    if business_key is None and redis_cli_fms:
        try:
            raw = await redis_cli_fms.hget("self:current_job", vehicle_id)
            payload = _decode_redis_value(raw)
            business_key = _parse_business_key(payload, vehicle_id)
            if business_key:
                await redis_cli.set(
                    f"{BUSINESS_KEY_CACHE_PREFIX}{vehicle_id}",
                    business_key,
                    ex=3600,
                )
        except Exception as exc:
            logger.error(f"manual_path exit: read business_key failed: {exc}")

    if business_key is None:
        return StdRes(data={"ok": False, "message": "business_key not found"})

    resend_url = f"{pp_visual_TASK_INFO_URL.rstrip('/')}/api/taskInfo/vehicleJob/resendJob"
    logger.info(
        f"manual_path exit forwarding: url={resend_url}, business_key={business_key}, vehicle_id={vehicle_id}"
    )
    res = await aio_http.post(
        resend_url,
        json={"business_keys": [business_key]},
        timeout=10,
    )
    try:
        json_attr = getattr(res, "json", None)
        if callable(json_attr):
            data = await json_attr()
        else:
            data = json_attr
    except Exception:
        text_attr = getattr(res, "text", None)
        if callable(text_attr):
            raw = await text_attr()
        else:
            raw = text_attr
        data = {"raw": raw}

    logger.info(f"manual_path exit response: status={res.status}, payload={data}")
    return StdRes(data={"ok": res.status == 200, "result": data})
