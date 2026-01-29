import json
import math

from fastapi import APIRouter, Body
from chain_http import aio_http
from chain_model.model import StdRes

from src.core.config import pp_visual_BRIDGE_URL
from src.core.log import logger
from src.routing import normalize_angle

router = APIRouter()


@router.post("/message")
async def bridge_message(req: dict = Body()) -> StdRes:
    bridge_url = f"{pp_visual_BRIDGE_URL.rstrip('/')}/api/bridge/message"
    top_name = req.get("topName")
    qos_code = req.get("qosCode")
    payload = req.get("payload")
    forward_req = req
    payload_len = len(payload) if isinstance(payload, str) else None
    payload_obj = payload if isinstance(payload, dict) else None
    if payload_obj is None and isinstance(payload, str):
        try:
            payload_obj = json.loads(payload)
        except Exception:
            payload_obj = None
    header_info = payload_obj.get("header") if isinstance(payload_obj, dict) else None
    body_info = payload_obj.get("body") if isinstance(payload_obj, dict) else None
    logger.info(
        f"bridge message incoming: url={bridge_url}, topName={top_name}, qosCode={qos_code}, "
        f"payloadType={type(payload).__name__}, payloadLen={payload_len}"
    )
    logger.info(
        f"bridge message payload summary: header={header_info}, "
        f"bodyKeys={list(body_info.keys()) if isinstance(body_info, dict) else None}"
    )
    if isinstance(body_info, dict):
        command_lines = body_info.get("command_reference_lines") or []
        if not body_info.get("backward_motion"):
            path_guidance = body_info.get("pathGuidance")
            points = path_guidance.get("points") if isinstance(path_guidance, dict) else None
            if isinstance(points, list):
                for point in points:
                    if isinstance(point, dict):
                        point["direction"] = 1
        if body_info.get("backward_motion") and isinstance(command_lines, list):
            for line in command_lines:
                points = line.get("points") if isinstance(line, dict) else None
                if not isinstance(points, list):
                    continue
                for point in points:
                    if not isinstance(point, dict):
                        continue
                    for key in ("course_angle", "heading_angle"):
                        if point.get(key) is None:
                            continue
                        try:
                            point[key] = normalize_angle(float(point[key]) + math.pi)
                        except (TypeError, ValueError):
                            continue
        command_points = 0
        if isinstance(command_lines, list):
            for line in command_lines:
                points = line.get("points") if isinstance(line, dict) else None
                if isinstance(points, list):
                    command_points += len(points)
        logger.info(
            f"bridge message path summary: commandLines={len(command_lines) if isinstance(command_lines, list) else None}, "
            f"commandPoints={command_points}"
        )
        forward_payload = {
            "header": header_info or {},
            "body": json.dumps(body_info, ensure_ascii=False),
            "type": payload_obj.get("type", 2) if isinstance(payload_obj, dict) else 2,
        }
        forward_req = {
            **req,
            "payload": json.dumps(forward_payload, ensure_ascii=False),
        }
        logger.info(f"bridge message payload reformatted: payloadLen={len(forward_req['payload'])}")
    logger.info(f"bridge message forwarding raw: payload={forward_req}")
    res = await aio_http.post(bridge_url, json=forward_req, timeout=10)
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
    logger.info(f"bridge message response: status={res.status}, payload={data}")
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            data = {"raw": data}
    return StdRes(data={"ok": res.status == 200, "result": data})
