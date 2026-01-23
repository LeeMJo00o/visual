import asyncio
import heapq
import json
import math
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from chain_http import aio_http
from chain_model.model import StdRes
from fastapi import APIRouter, Body, Query

from src.core.config import (
    pp_visual_TASK_EXECUTOR_URL,
    pp_visual_TASK_INFO_URL,
)
from src.core.log import logger
from src.middlewares.redis_handler.connect import redis_cli, redis_cli_fms
from src.routing import normalize_angle

router = APIRouter()

BUSINESS_KEY_CACHE_PREFIX = "pp_visual:parking_path:business_key:"
PERCEPTION_OBSTACLES_KEY = "pp_visual:perception:obstacles"
PLANNER_STEP_SIZE = 0.5
OBSTACLE_INFLATION = 0.5


@dataclass(order=True)
class _HybridQueueNode:
    priority: float
    count: int
    node: Any = field(compare=False)


@dataclass
class _HybridNode:
    x: float
    y: float
    heading: float
    cost: float
    parent: "_HybridNode | None" = None


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


def _parse_obstacle_points(payload: Any) -> list[tuple[float, float]]:
    if payload is None:
        return []
    if isinstance(payload, bytes):
        try:
            payload = payload.decode("utf-8")
        except Exception:
            return []
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            return []

    points: list[tuple[float, float]] = []
    if isinstance(payload, dict):
        payload = payload.get("points") or payload.get("data") or payload.get("obstacles") or []
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                x = item.get("x")
                y = item.get("y")
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                x, y = item[0], item[1]
            else:
                continue
            try:
                points.append((float(x), float(y)))
            except (TypeError, ValueError):
                continue
    return points


async def _load_perception_obstacles(vehicle_id: str) -> list[tuple[float, float]]:
    if not redis_cli:
        return []
    keys = [
        f"{PERCEPTION_OBSTACLES_KEY}:{vehicle_id}",
        PERCEPTION_OBSTACLES_KEY,
    ]
    for key in keys:
        try:
            raw = await redis_cli.get(key)
        except Exception as exc:
            logger.error(f"parking_path plan: read perception obstacles failed: {exc}")
            return []
        points = _parse_obstacle_points(raw)
        if points:
            return points
    return []


def _heuristic_distance(x: float, y: float, goal: dict) -> float:
    return math.hypot(goal["x"] - x, goal["y"] - y)


def _is_collision(x: float, y: float, obstacles: list[tuple[float, float]], radius: float) -> bool:
    if not obstacles:
        return False
    radius_sq = radius * radius
    for ox, oy in obstacles:
        dx = x - ox
        dy = y - oy
        if dx * dx + dy * dy <= radius_sq:
            return True
    return False


def _plan_hybrid_a_star(start: dict, goal: dict, obstacles: list[tuple[float, float]]) -> list[dict]:
    heading_bins = 24
    max_iter = 20000
    wheel_base = 3.576
    max_steer = 0.6
    goal_tolerance = 0.8
    heading_tolerance = 0.5
    vehicle_radius = 1.2
    obstacle_radius = vehicle_radius + OBSTACLE_INFLATION

    def _heading_index(theta: float) -> int:
        return int(round((normalize_angle(theta) + math.pi) / (2 * math.pi) * heading_bins)) % heading_bins

    def _node_key(node: _HybridNode) -> tuple[int, int, int]:
        return (
            int(round(node.x / PLANNER_STEP_SIZE)),
            int(round(node.y / PLANNER_STEP_SIZE)),
            _heading_index(node.heading),
        )

    open_queue: list[_HybridQueueNode] = []
    seen: dict[tuple[int, int, int], float] = {}
    counter = 0
    start_node = _HybridNode(start["x"], start["y"], start["heading"], 0.0, None)
    start_key = _node_key(start_node)
    seen[start_key] = 0.0
    start_priority = _heuristic_distance(start_node.x, start_node.y, goal)
    heapq.heappush(open_queue, _HybridQueueNode(start_priority, counter, start_node))

    while open_queue and len(seen) < max_iter:
        current = heapq.heappop(open_queue).node
        if (
            _heuristic_distance(current.x, current.y, goal) <= goal_tolerance
            and abs(normalize_angle(current.heading - goal["heading"])) <= heading_tolerance
        ):
            path: list[dict] = []
            node = current
            while node:
                path.append({"x": node.x, "y": node.y, "heading": node.heading})
                node = node.parent
            return list(reversed(path))

        for direction in (1.0, -1.0):
            for steer in (-max_steer, 0.0, max_steer):
                next_heading = normalize_angle(
                    current.heading + direction * PLANNER_STEP_SIZE / wheel_base * math.tan(steer)
                )
                next_x = current.x + direction * PLANNER_STEP_SIZE * math.cos(current.heading)
                next_y = current.y + direction * PLANNER_STEP_SIZE * math.sin(current.heading)
                if _is_collision(next_x, next_y, obstacles, obstacle_radius):
                    continue
                next_node = _HybridNode(next_x, next_y, next_heading, current.cost + PLANNER_STEP_SIZE, current)
                key = _node_key(next_node)
                if key in seen and seen[key] <= next_node.cost:
                    continue
                seen[key] = next_node.cost
                counter += 1
                priority = next_node.cost + _heuristic_distance(next_x, next_y, goal)
                heapq.heappush(open_queue, _HybridQueueNode(priority, counter, next_node))
    return []


@router.post("/enter")
async def enter_parking_path(req: dict = Body()) -> StdRes:
    vehicle_id = req.get("vehicle_id")
    origin = req.get("origin", "GUI")
    logger.info(f"parking_path enter request: {req}")
    if not vehicle_id:
        return StdRes(data={"ok": False, "message": "vehicle_id is required"})

    business_key = None
    if redis_cli_fms:
        try:
            raw = await redis_cli_fms.hget("self:current_job", vehicle_id)
            payload = _decode_redis_value(raw)
            business_key = _parse_business_key(payload, vehicle_id)
        except Exception as exc:
            logger.error(f"parking_path enter: read business_key failed: {exc}")

    if business_key:
        await redis_cli.set(f"{BUSINESS_KEY_CACHE_PREFIX}{vehicle_id}", business_key, ex=3600)

    abort_url = f"{pp_visual_TASK_EXECUTOR_URL.rstrip('/')}/message_event/abort"
    try:
        logger.info(f"parking_path enter abort request: url={abort_url}, vehicle_id={vehicle_id}, origin={origin}")
        await aio_http.post(
            abort_url,
            params={"vehicle_id": vehicle_id},
            json={"origin": origin},
            timeout=5,
        )
    except Exception as exc:
        logger.error(f"parking_path enter: abort failed: {exc}")
        return StdRes(data={"ok": False, "message": "abort failed", "business_key": business_key})

    logger.info(f"parking_path enter response: ok=True, business_key={business_key}")
    return StdRes(data={"ok": True, "business_key": business_key})


@router.post("/plan")
async def plan_parking_path(req: dict = Body()) -> StdRes:
    vehicle_id = req.get("vehicle_id")
    points = req.get("points") or req.get("point")
    logger.info(f"parking_path plan request: {req}")
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
        logger.error(f"parking_path plan: read pose failed: {exc}")
    logger.info(f"parking_path plan: raw_pose={pose}")

    start_pose = _build_start_pose(pose)
    end_pose = {
        "x": float(points["x"]),
        "y": float(points["y"]),
        "heading": float(points.get("heading", 0.0)),
    }
    logger.info(f"parking_path plan: start_pose={start_pose}, end_pose={end_pose}")
    obstacles = await _load_perception_obstacles(vehicle_id)
    logger.info(f"parking_path plan: obstacles={len(obstacles)}")
    if obstacles:
        logger.info(f"parking_path plan: obstacle_sample={obstacles[:5]}")
    path = _plan_hybrid_a_star(start_pose, end_pose, obstacles)
    if not path:
        logger.warning(
            "parking_path plan: failed, start_pose=%s, end_pose=%s, obstacles=%s",
            start_pose,
            end_pose,
            len(obstacles),
        )
        return StdRes(data={"ok": False, "message": "hybrid plan failed"})
    logger.info(f"parking_path plan: success, path_size={len(path)}")
    return StdRes(data={"ok": True, "target": end_pose, "path": path})


@router.get("/obstacles")
async def get_parking_obstacles(vehicle_id: str | None = Query(default=None)) -> StdRes:
    if not vehicle_id:
        return StdRes(data={"ok": False, "message": "vehicle_id is required"})
    points = await _load_perception_obstacles(vehicle_id)
    return StdRes(data={"ok": True, "points": [{"x": x, "y": y} for x, y in points]})


@router.post("/exit")
async def exit_parking_path(req: dict = Body()) -> StdRes:
    vehicle_id = req.get("vehicle_id")
    logger.info(f"parking_path exit request: {req}")
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
            logger.error(f"parking_path exit: read business_key failed: {exc}")

    if business_key is None:
        return StdRes(data={"ok": False, "message": "business_key not found"})

    resend_url = f"{pp_visual_TASK_INFO_URL.rstrip('/')}/api/taskInfo/vehicleJob/resendJob"
    logger.info(
        f"parking_path exit forwarding: url={resend_url}, business_key={business_key}, vehicle_id={vehicle_id}"
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

    logger.info(f"parking_path exit response: status={res.status}, payload={data}")
    return StdRes(data={"ok": res.status == 200, "result": data})
