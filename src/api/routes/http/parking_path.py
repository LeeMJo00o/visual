import asyncio
import ast
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
VEHICLE_LENGTH = 15.48
VEHICLE_WIDTH = 2.8
WHEEL_BASE = 9.3
MAX_STEER = 0.34
MIN_TURN_RADIUS = 8.1
MAX_CURVATURE = 0.14
ALLOW_REVERSE_DEFAULT = True
REVERSE_HEADING_DIFF_THRESHOLD = math.radians(120)
STOP_SPEED_THRESHOLD = 0.02
STOP_STEER_DEG = 0.5
STRAIGHT_HEADING_TOLERANCE = 0.6
HYBRID_GOAL_HEADING_TOLERANCE = 0.15


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


def _extract_speed(pose: dict | None) -> float | None:
    if not pose:
        return None
    for key in ("speed", "v", "velocity", "vel", "spd"):
        value = pose.get(key)
        if value is None:
            continue
        try:
            return abs(float(value))
        except (TypeError, ValueError):
            continue
    vx = pose.get("vx") if pose.get("vx") is not None else pose.get("v_x")
    vy = pose.get("vy") if pose.get("vy") is not None else pose.get("v_y")
    if vx is None and vy is None:
        return None
    try:
        return math.hypot(float(vx or 0.0), float(vy or 0.0))
    except (TypeError, ValueError):
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
            "speed": None,
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
        "speed": _extract_speed(pose),
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


def _plan_hybrid_a_star(
    start: dict,
    goal: dict,
    obstacles: list[tuple[float, float]],
    allow_reverse: bool,
    start_speed: float = 0.0,
) -> list[dict]:
    heading_bins = 24
    max_iter = 20000
    goal_tolerance = 0.8
    heading_tolerance = HYBRID_GOAL_HEADING_TOLERANCE
    vehicle_radius = VEHICLE_WIDTH / 2.0
    obstacle_radius = vehicle_radius + OBSTACLE_INFLATION
    position_limit = 10000.0
    steer_curvature = abs(math.tan(MAX_STEER) / WHEEL_BASE)
    max_curvature = min(MAX_CURVATURE, 1.0 / MIN_TURN_RADIUS, steer_curvature)
    stop_curvature = abs(math.tan(math.radians(STOP_STEER_DEG)) / WHEEL_BASE)
    is_stopped = abs(start_speed) < STOP_SPEED_THRESHOLD
    start_curvature_limit = min(max_curvature, stop_curvature) if is_stopped else max_curvature

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
    start_node = _HybridNode(
        start["x"],
        start["y"],
        start["heading"],
        0.0,
        None,
    )
    start_key = _node_key(start_node)
    seen[start_key] = 0.0
    start_priority = _heuristic_distance(start_node.x, start_node.y, goal)
    heapq.heappush(open_queue, _HybridQueueNode(start_priority, counter, start_node))

    while open_queue and len(seen) < max_iter:
        current = heapq.heappop(open_queue).node
        distance_to_goal = _heuristic_distance(current.x, current.y, goal)
        if (
            distance_to_goal <= goal_tolerance
            and abs(normalize_angle(current.heading - goal["heading"])) <= heading_tolerance
        ):
            path: list[dict] = []
            node = current
            while node:
                path.append({"x": node.x, "y": node.y, "heading": node.heading})
                node = node.parent
            return list(reversed(path))

        directions = (1.0, -1.0) if allow_reverse else (1.0,)
        curvature_limit = start_curvature_limit if current.parent is None else max_curvature
        curvatures = (0.0,) if curvature_limit < 1e-6 else (-curvature_limit, 0.0, curvature_limit)
        for direction in directions:
            for curvature in curvatures:
                next_heading = normalize_angle(current.heading + direction * PLANNER_STEP_SIZE * curvature)
                next_x = current.x + direction * PLANNER_STEP_SIZE * math.cos(current.heading)
                next_y = current.y + direction * PLANNER_STEP_SIZE * math.sin(current.heading)
                if abs(next_x) > position_limit or abs(next_y) > position_limit:
                    continue
                if _is_collision(next_x, next_y, obstacles, obstacle_radius):
                    continue
                next_cost = current.cost + PLANNER_STEP_SIZE
                next_node = _HybridNode(
                    next_x,
                    next_y,
                    next_heading,
                    next_cost,
                    current,
                )
                key = _node_key(next_node)
                if key in seen and seen[key] <= next_node.cost:
                    continue
                seen[key] = next_node.cost
                counter += 1
                priority = next_node.cost + _heuristic_distance(next_x, next_y, goal)
                heapq.heappush(open_queue, _HybridQueueNode(priority, counter, next_node))
    return []


def _build_straight_path(start: dict, goal: dict, heading: float, reverse: bool) -> list[dict]:
    path: list[dict] = [{"x": start["x"], "y": start["y"], "heading": heading}]
    dx = goal["x"] - start["x"]
    dy = goal["y"] - start["y"]
    distance = math.hypot(dx, dy)
    if distance < 1e-6:
        return path
    steps = max(1, int(math.ceil(distance / PLANNER_STEP_SIZE)))
    step = distance / steps
    x, y = start["x"], start["y"]
    direction = -1.0 if reverse else 1.0
    for _ in range(steps):
        x += direction * step * math.cos(heading)
        y += direction * step * math.sin(heading)
        path.append({"x": x, "y": y, "heading": heading})
    return path


def _build_simple_path(start: dict, goal: dict, allow_reverse: bool, start_speed: float = 0.0) -> list[dict]:
    steer_curvature = abs(math.tan(MAX_STEER) / WHEEL_BASE)
    max_curvature = min(MAX_CURVATURE, 1.0 / MIN_TURN_RADIUS, steer_curvature)
    rho = 1.0 / max_curvature
    path: list[dict] = []

    def _mod2pi(theta: float) -> float:
        return (theta + 2.0 * math.pi) % (2.0 * math.pi)

    def _dubins_params():
        dx = goal["x"] - start["x"]
        dy = goal["y"] - start["y"]
        distance = math.hypot(dx, dy)
        if distance < 1e-6:
            return ("S", (0.0, 0.0, 0.0))
        theta = math.atan2(dy, dx)
        alpha = _mod2pi(start["heading"] - theta)
        beta = _mod2pi(goal["heading"] - theta)
        d = distance / rho

        def lsl():
            tmp0 = d + math.sin(alpha) - math.sin(beta)
            p2 = 2 + d * d - 2 * math.cos(alpha - beta) + 2 * d * (math.sin(alpha) - math.sin(beta))
            if p2 < 0:
                return None
            tmp1 = math.atan2((math.cos(beta) - math.cos(alpha)), tmp0)
            t = _mod2pi(-alpha + tmp1)
            p = math.sqrt(p2)
            q = _mod2pi(beta - tmp1)
            return ("LSL", (t, p, q))

        def rsr():
            tmp0 = d - math.sin(alpha) + math.sin(beta)
            p2 = 2 + d * d - 2 * math.cos(alpha - beta) + 2 * d * (-math.sin(alpha) + math.sin(beta))
            if p2 < 0:
                return None
            tmp1 = math.atan2((math.cos(alpha) - math.cos(beta)), tmp0)
            t = _mod2pi(alpha - tmp1)
            p = math.sqrt(p2)
            q = _mod2pi(-beta + tmp1)
            return ("RSR", (t, p, q))

        def lsr():
            p2 = -2 + d * d + 2 * math.cos(alpha - beta) + 2 * d * (math.sin(alpha) + math.sin(beta))
            if p2 < 0:
                return None
            p = math.sqrt(p2)
            tmp2 = math.atan2((-math.cos(alpha) - math.cos(beta)), d + math.sin(alpha) + math.sin(beta)) - math.atan2(
                -2.0, p
            )
            t = _mod2pi(-alpha + tmp2)
            q = _mod2pi(-beta + tmp2)
            return ("LSR", (t, p, q))

        def rsl():
            p2 = -2 + d * d + 2 * math.cos(alpha - beta) - 2 * d * (math.sin(alpha) + math.sin(beta))
            if p2 < 0:
                return None
            p = math.sqrt(p2)
            tmp2 = math.atan2((math.cos(alpha) + math.cos(beta)), d - math.sin(alpha) - math.sin(beta)) - math.atan2(
                2.0, p
            )
            t = _mod2pi(alpha - tmp2)
            q = _mod2pi(beta - tmp2)
            return ("RSL", (t, p, q))

        candidates = [lsl(), rsr(), lsr(), rsl()]
        valid = [c for c in candidates if c is not None]
        if not valid:
            return ("S", (0.0, d, 0.0))
        best = min(valid, key=lambda item: sum(item[1]))
        return best

    dx = goal["x"] - start["x"]
    dy = goal["y"] - start["y"]
    line_heading = math.atan2(dy, dx)
    distance = math.hypot(dx, dy)
    straight_heading_tolerance = STRAIGHT_HEADING_TOLERANCE
    if abs(start_speed) < STOP_SPEED_THRESHOLD:
        straight_heading_tolerance = min(straight_heading_tolerance, math.radians(STOP_STEER_DEG))
    start_heading_error = abs(normalize_angle(start["heading"] - line_heading))
    goal_heading_error = abs(normalize_angle(goal["heading"] - line_heading))
    if start_heading_error <= straight_heading_tolerance and goal_heading_error <= straight_heading_tolerance:
        return _build_straight_path(start, goal, line_heading, False)
    if allow_reverse:
        reverse_heading = normalize_angle(line_heading + math.pi)
        start_reverse_error = abs(normalize_angle(start["heading"] - reverse_heading))
        goal_reverse_error = abs(normalize_angle(goal["heading"] - reverse_heading))
        if start_reverse_error <= straight_heading_tolerance and goal_reverse_error <= straight_heading_tolerance:
            return _build_straight_path(start, goal, reverse_heading, True)

    mode, (t, p, q) = _dubins_params()
    x, y, heading = start["x"], start["y"], start["heading"]
    path.append({"x": x, "y": y, "heading": heading})

    def _segment(seg_type: str, seg_length: float):
        nonlocal x, y, heading
        remaining = seg_length * rho
        while remaining > 1e-6:
            step = min(PLANNER_STEP_SIZE, remaining)
            if seg_type == "S":
                x += step * math.cos(heading)
                y += step * math.sin(heading)
            else:
                delta = step / rho
                if seg_type == "L":
                    heading = normalize_angle(heading + delta)
                    x += rho * (math.sin(heading) - math.sin(heading - delta))
                    y -= rho * (math.cos(heading) - math.cos(heading - delta))
                else:
                    heading = normalize_angle(heading - delta)
                    x -= rho * (math.sin(heading) - math.sin(heading + delta))
                    y += rho * (math.cos(heading) - math.cos(heading + delta))
            path.append({"x": x, "y": y, "heading": heading})
            remaining -= step

    segments = {
        "LSL": ("L", "S", "L"),
        "RSR": ("R", "S", "R"),
        "LSR": ("L", "S", "R"),
        "RSL": ("R", "S", "L"),
        "S": ("S", "S", "S"),
    }
    seg_types = segments.get(mode, ("S", "S", "S"))
    _segment(seg_types[0], t)
    _segment(seg_types[1], p)
    _segment(seg_types[2], q)
    return path


def _calc_straight_mode(
    start_pose: dict,
    end_pose: dict,
    allow_reverse: bool,
    start_speed: float,
) -> tuple[bool, float, bool, float, float, float]:
    dx = end_pose["x"] - start_pose["x"]
    dy = end_pose["y"] - start_pose["y"]
    line_heading = math.atan2(dy, dx)
    reverse_line_heading = normalize_angle(line_heading + math.pi)
    heading_diff = abs(normalize_angle(start_pose["heading"] - line_heading))
    reverse_heading_diff = abs(normalize_angle(start_pose["heading"] - reverse_line_heading))
    reverse_start = bool(allow_reverse and reverse_heading_diff < heading_diff)

    straight_heading_tolerance = STRAIGHT_HEADING_TOLERANCE
    if abs(start_speed) < STOP_SPEED_THRESHOLD:
        straight_heading_tolerance = min(straight_heading_tolerance, math.radians(STOP_STEER_DEG))

    travel_heading = reverse_line_heading if reverse_start else line_heading
    start_error = abs(normalize_angle(start_pose["heading"] - travel_heading))
    goal_error = abs(normalize_angle(end_pose["heading"] - travel_heading))
    can_straight = start_error <= straight_heading_tolerance and goal_error <= straight_heading_tolerance
    return (can_straight, travel_heading, reverse_start, straight_heading_tolerance, start_error, goal_error)


RUN_AREAS_KEY = "pp_visual:parking_path:run_areas"
NO_RUN_AREAS_KEY = "pp_visual:parking_path:no_run_areas"
DEFAULT_RUN_AREAS = [
    [(84.726, -572.809), (-37.087, -1268.711), (-21.702, -1270.487), (105.851, -575.139)],
    [(352.309, -620.029), (229.085, -1318.748), (245.866, -1319.991), (370.430, -622.527)],
    [(618.297, -666.568), (497.099, -1361.706), (510.565, -1365.208), (638.766, -667.107)],
    [(-250.847, 55.085), (-240.235, -512.303), (643.740, -668.288), (742.151, -121.034)],
    [(-257.877, -1232.300), (-268.381, -1274.584), (643.298, -1435.105), (647.876, -1394.167)],
]
RUN_AREA_SEGMENT_STEP = 0.2


def _normalize_run_areas(value: Any) -> list[list[tuple[float, float]]]:
    if value is None:
        return []
    if isinstance(value, bytes):
        try:
            value = value.decode("utf-8")
        except Exception:
            return []
    if isinstance(value, str):
        stripped = value.strip()
        if (stripped.startswith("b'") and stripped.endswith("'")) or (
            stripped.startswith('b"') and stripped.endswith('"')
        ):
            try:
                value = ast.literal_eval(stripped)
                if isinstance(value, bytes):
                    value = value.decode("utf-8")
            except Exception:
                return []
    for _ in range(2):
        if not isinstance(value, str):
            break
        try:
            value = json.loads(value)
            continue
        except Exception:
            try:
                value = ast.literal_eval(value)
            except Exception:
                return []
        if not isinstance(value, str):
            break
    if not isinstance(value, list):
        return []
    normalized: list[list[tuple[float, float]]] = []
    for polygon in value:
        if not isinstance(polygon, list):
            continue
        points: list[tuple[float, float]] = []
        for point in polygon:
            if isinstance(point, dict):
                px = point.get("x")
                py = point.get("y")
            elif isinstance(point, (list, tuple)) and len(point) >= 2:
                px, py = point[0], point[1]
            else:
                continue
            try:
                points.append((float(px), float(py)))
            except (TypeError, ValueError):
                continue
        if len(points) >= 3:
            normalized.append(points)
    return normalized


async def _load_run_areas() -> list[list[tuple[float, float]]]:
    if not redis_cli:
        logger.info(f"parking_path: run_areas={DEFAULT_RUN_AREAS}")
        return DEFAULT_RUN_AREAS
    try:
        raw = await redis_cli.get(RUN_AREAS_KEY)
    except Exception as exc:
        logger.warning(f"parking_path: read run_areas failed: {exc}")
        logger.info(f"parking_path: run_areas={DEFAULT_RUN_AREAS}")
        return DEFAULT_RUN_AREAS
    logger.info(f"parking_path: raw run_areas value={raw} type={type(raw)}")
    parsed = _normalize_run_areas(raw)
    if not parsed:
        logger.info(f"parking_path: run_areas={DEFAULT_RUN_AREAS}")
        return DEFAULT_RUN_AREAS
    logger.info(f"parking_path: run_areas={parsed}")
    return parsed


async def _load_no_run_areas() -> list[list[tuple[float, float]]]:
    if not redis_cli:
        logger.info("parking_path: no_run_areas=[]")
        return []
    try:
        raw = await redis_cli.get(NO_RUN_AREAS_KEY)
    except Exception as exc:
        logger.warning(f"parking_path: read no_run_areas failed: {exc}")
        return []
    logger.info(f"parking_path: raw no_run_areas value={raw} type={type(raw)}")
    parsed = _normalize_run_areas(raw)
    logger.info(f"parking_path: no_run_areas={parsed}")
    return parsed


def _point_in_polygon(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        intersects = (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi
        if intersects:
            inside = not inside
        j = i
    return inside


def _point_in_any_run_area(x: float, y: float, run_areas: list[list[tuple[float, float]]]) -> bool:
    for polygon in run_areas:
        if _point_in_polygon(x, y, polygon):
            return True
    return False


def _is_path_within_run_area(path: list[dict], run_areas: list[list[tuple[float, float]]]) -> bool:
    if not path:
        return False
    for index, point in enumerate(path):
        x = point.get("x")
        y = point.get("y")
        if x is None or y is None:
            return False
        if not _point_in_any_run_area(float(x), float(y), run_areas):
            return False
        if index == 0:
            continue
        prev = path[index - 1]
        prev_x = prev.get("x")
        prev_y = prev.get("y")
        if prev_x is None or prev_y is None:
            return False
        dx = float(x) - float(prev_x)
        dy = float(y) - float(prev_y)
        dist = math.hypot(dx, dy)
        steps = max(1, int(math.ceil(dist / RUN_AREA_SEGMENT_STEP)))
        for step_index in range(1, steps):
            ratio = step_index / steps
            sample_x = float(prev_x) + dx * ratio
            sample_y = float(prev_y) + dy * ratio
            if not _point_in_any_run_area(sample_x, sample_y, run_areas):
                return False
    return True


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
    allow_reverse = bool(req.get("allow_reverse", ALLOW_REVERSE_DEFAULT))
    start_speed = start_pose.get("speed")
    if start_speed is None:
        start_speed = STOP_SPEED_THRESHOLD
    (
        straight_mode_can_straight,
        straight_mode_heading,
        straight_mode_reverse_start,
        straight_mode_tolerance,
        straight_mode_start_error,
        straight_mode_goal_error,
    ) = _calc_straight_mode(start_pose, end_pose, allow_reverse, start_speed)

    if straight_mode_can_straight:
        # Keep path-point heading semantics consistent with existing reverse-start planning:
        # heading follows travel direction; reverse_start indicates whether vehicle head is opposite.
        straight_path = _build_straight_path(
            start_pose,
            end_pose,
            straight_mode_heading,
            straight_mode_reverse_start,
        )
        run_areas = await _load_run_areas()
        path_valid = _is_path_within_run_area(straight_path, run_areas)
        logger.info(
            "parking_path plan: use straight path, "
            f"path_size={len(straight_path)}, "
            f"start_error={straight_mode_start_error:.4f}, "
            f"goal_error={straight_mode_goal_error:.4f}, "
            f"threshold={straight_mode_tolerance:.4f}, "
            f"reverse_start={straight_mode_reverse_start}, "
            f"run_area_valid={path_valid}"
        )
        if not path_valid:
            return StdRes(data={"ok": False, "message": "path out of run area"})
        return StdRes(
            data={
                "ok": True,
                "target": end_pose,
                "path": straight_path,
                "reverse_start": straight_mode_reverse_start,
            }
        )

    half_length = VEHICLE_LENGTH / 2.0
    front_mid_x = start_pose["x"] + math.cos(start_pose["heading"]) * half_length
    front_mid_y = start_pose["y"] + math.sin(start_pose["heading"]) * half_length
    rear_mid_x = start_pose["x"] - math.cos(start_pose["heading"]) * half_length
    rear_mid_y = start_pose["y"] - math.sin(start_pose["heading"]) * half_length
    front_mid_dist = math.hypot(end_pose["x"] - front_mid_x, end_pose["y"] - front_mid_y)
    rear_mid_dist = math.hypot(end_pose["x"] - rear_mid_x, end_pose["y"] - rear_mid_y)
    dist_diff = rear_mid_dist - front_mid_dist
    reverse_start = allow_reverse and dist_diff < 0
    start_for_plan = start_pose.copy()
    if reverse_start:
        start_for_plan["heading"] = normalize_angle(start_for_plan["heading"] + math.pi)
    logger.info(
        "parking_path plan: limits "
        f"max_curvature={min(MAX_CURVATURE, 1.0 / MIN_TURN_RADIUS, abs(math.tan(MAX_STEER) / WHEEL_BASE)):.4f}, "
        f"min_turn_radius={MIN_TURN_RADIUS:.2f}, "
        f"max_steer={MAX_STEER:.2f}, "
        f"wheel_base={WHEEL_BASE:.2f}, "
        f"vehicle_size={VEHICLE_LENGTH:.2f}x{VEHICLE_WIDTH:.2f}, "
        f"allow_reverse={allow_reverse}, "
        f"front_mid_dist={front_mid_dist:.2f}, "
        f"rear_mid_dist={rear_mid_dist:.2f}, "
        f"dist_diff={dist_diff:.2f}, "
        f"reverse_start={reverse_start}"
    )
    obstacles = await _load_perception_obstacles(vehicle_id)
    logger.info(f"parking_path plan: obstacles={len(obstacles)}")
    if obstacles:
        logger.info(f"parking_path plan: obstacle_sample={obstacles[:5]}")
    run_areas = await _load_run_areas()
    path = _plan_hybrid_a_star(start_for_plan, end_pose, obstacles, allow_reverse, start_speed)
    if not path:
        if not obstacles:
            fallback_path = _build_simple_path(start_for_plan, end_pose, allow_reverse, start_speed)
            logger.info(f"parking_path plan: fallback path_size={len(fallback_path)}")
            fallback_valid = _is_path_within_run_area(fallback_path, run_areas)
            logger.info(f"parking_path plan: fallback run_area_valid={fallback_valid}")
            if not fallback_valid:
                return StdRes(data={"ok": False, "message": "path out of run area"})
            return StdRes(
                data={
                    "ok": True,
                    "target": end_pose,
                    "path": fallback_path,
                    "fallback": True,
                    "reverse_start": reverse_start,
                }
            )
        logger.warning(
            "parking_path plan: failed, "
            f"start_pose={start_pose}, end_pose={end_pose}, obstacles={len(obstacles)}"
        )
        return StdRes(data={"ok": False, "message": "hybrid plan failed"})
    path_valid = _is_path_within_run_area(path, run_areas)
    logger.info(
        f"parking_path plan: success, path_size={len(path)}, run_area_valid={path_valid}"
    )
    if not path_valid:
        return StdRes(data={"ok": False, "message": "path out of run area"})
    return StdRes(
        data={
            "ok": True,
            "target": end_pose,
            "path": path,
            "reverse_start": reverse_start,
        }
    )


@router.get("/obstacles")
async def get_parking_obstacles(vehicle_id: str | None = Query(default=None)) -> StdRes:
    if not vehicle_id:
        return StdRes(data={"ok": False, "message": "vehicle_id is required"})
    points = await _load_perception_obstacles(vehicle_id)
    return StdRes(data={"ok": True, "points": [{"x": x, "y": y} for x, y in points]})


@router.get("/run_areas")
async def get_parking_run_areas() -> StdRes:
    run_areas = await _load_run_areas()
    return StdRes(
        data={
            "ok": True,
            "areas": [
                [{"x": float(x), "y": float(y)} for x, y in polygon] for polygon in run_areas
            ],
        }
    )


@router.get("/no_run_areas")
async def get_parking_no_run_areas() -> StdRes:
    run_areas = await _load_no_run_areas()
    return StdRes(
        data={
            "ok": True,
            "areas": [
                [{"x": float(x), "y": float(y)} for x, y in polygon] for polygon in run_areas
            ],
        }
    )


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
