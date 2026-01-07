import multiprocessing as mp
import time
from tests.data_sample.demo_path_data import sa_1
from enum import StrEnum
from typing import TypeAlias, List, Tuple
from scipy.special import comb
import numpy as np
import lanelet2
import os
import re
from lanelet2.core import Lanelet, BasicPoint3d, Point3d
import math
from src.core.log import logger
from src.core.config import MAP_NAME
from shapely.geometry import Polygon, MultiPolygon
import json
from dataclasses import dataclass

class Pose():
    def __init__(self, x, y, yaw, tx=None, ty=None, tyaw=None):
        self.x = x
        self.y = y
        self.yaw = yaw
        self.tx = tx
        self.ty = ty
        self.tyaw = tyaw

    def update(self, x, y, yaw, tx, ty, tyaw):
        self.__init__(x, y, yaw, tx, ty, tyaw)

    @classmethod
    def from_point(cls, point: BasicPoint3d):
        return cls(point.x, point.y, 0.0)

    def has_trailer_value(self):
        if self.tx is not None and self.ty is not None and self.tyaw is not None:
            return True

    def __repr__(self):
        return f"Pose({self.x}, {self.y}, {self.yaw} <= {self.tx}, {self.ty}, {self.tyaw})"

    @classmethod
    def from_dict(cls, pos: dict):
        x, y, yaw = pos["x"], pos["y"], pos["heading"]
        tx = x - truck_model.hitch_t * math.cos(yaw) - truck_model.hitch_v * math.cos(yaw)
        ty = y - truck_model.hitch_t * math.sin(yaw) - truck_model.hitch_v * math.sin(yaw)
        return cls(
            x=pos["x"],
            y=pos["y"],
            yaw=pos["heading"],
            tx=tx,
            ty=ty,
            tyaw=pos["heading"]
        )


class PathType(StrEnum):
    self_lane_change = "self_lane_change"
    pp_plan = "pp_plan"


Path: TypeAlias = list[Pose]


class NaviPath():
    def __init__(self, path: Path, type_t: PathType = PathType.pp_plan):
        self.path = path
        self.type = type_t


class RouteGraph():
    def __init__(self, raw_route_graph: dict):
        self._raw_route_graph = raw_route_graph


def get_map_info(file_path: str) -> dict:
    _result = {"version": '', "lat": '', "lon": ''}
    if not os.path.exists(file_path):
        print(f"map file not exits: {file_path}")
        return _result
    with open(file_path, 'r') as f:
        for line in f:
            if "user" not in line:
                continue
            for key in _result.keys():
                match = re.search(f"{key}='(.*?)'", line)
                if match:
                    _result[key] = match.group(1)

                match = re.search(f'{key}="(.*?)"', line)
                if match:
                    _result[key] = float(match.group(1))
            break
    return _result


def load_map(map_path: str):
    map_info = get_map_info(map_path)
    proj = lanelet2.projection.UtmProjector(lanelet2.io.Origin(float(map_info["lat"]), float(map_info["lon"])))
    map = lanelet2.io.load(map_path, proj)

    return map


def bernstein_poly(n, k, t):
    """伯恩斯坦多项式"""
    return comb(n, k) * (t**k) * ((1 - t)**(n - k))


def bezier_curve(points, num=20):
    """生成贝塞尔曲线"""
    n = len(points) - 1
    t = np.linspace(0, 1, num)
    curve = np.zeros((num, 2))
    for i in range(n + 1):
        curve += np.outer(bernstein_poly(n, i, t), points[i])
    return curve


def normalize_angle(angle):
    while angle > math.pi:
        angle -= 2.0 * math.pi

    while angle < -math.pi:
        angle += 2.0 * math.pi

    return angle


class TruckModel():
    def __init__(self):
        self.v_length = 6.15
        self.back_edge_to_center = 0.885
        self.wheel_base = 3.576
        self.hitch_v = -0.373
        self.hitch_t = 10.0
        self.dt = 0.3
        self.trailer_ratio = 0.85


def point_distance(p1, p2):
    return math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

def vec_point_distance(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


truck_model = TruckModel()


def rect_vertices(cx, cy, w, h, theta):
    # 计算半宽和半高
    half_w = w / 2
    half_h = h / 2

    # 四个角的相对坐标（未旋转时）
    corners = [
        (-half_w, -half_h),
        (half_w, -half_h),
        (half_w, half_h),
        (-half_w, half_h)
    ]

    # 旋转后的顶点
    vertices = []
    for x, y in corners:
        # 应用旋转矩阵
        rotated_x = x * math.cos(theta) - y * math.sin(theta)
        rotated_y = x * math.sin(theta) + y * math.cos(theta)
        # 加上中心点偏移
        vertices.append((cx + rotated_x, cy + rotated_y))

    return vertices


def get_truck_contour(x, y, yaw, tx, ty, tyaw) -> Polygon:
    vertices_head = rect_vertices(x, y, 6, 2.5, yaw)
    p1 = Polygon(vertices_head)
    if tx is not None and ty is not None and tyaw is not None:
        vertices_trailer = rect_vertices(tx, ty, 12, 2.5, tyaw)
        p2 = Polygon(vertices_trailer)
        c = p1.union(p2)
    else:
        c = p1
    return c


def generate_trailer_pose(short_path: list[Pose], init_tyaw: float | None = None):
    for i, pose in enumerate(short_path):
        if i == 0:
            if init_tyaw is None:
                pose.tyaw = pose.yaw
            else:
                pose.tyaw = init_tyaw
            if pose.tx is None:
                pose.tx = (
                    pose.x - truck_model.hitch_t * math.cos(pose.tyaw) - truck_model.hitch_v * math.cos(pose.yaw)
                )
                pose.ty = (
                    pose.y - truck_model.hitch_t * math.sin(pose.tyaw) - truck_model.hitch_v * math.sin(pose.yaw)
                )
        else:
            prev_pose = short_path[i - 1]
            tt_angle = normalize_angle(prev_pose.yaw - prev_pose.tyaw)
            tt_angle *= truck_model.trailer_ratio
            diff_yaw = normalize_angle(pose.yaw - prev_pose.yaw)
            tan_steer = diff_yaw * truck_model.wheel_base / truck_model.dt
            angle_t = prev_pose.tyaw \
                + truck_model.dt \
                / truck_model.hitch_t \
                * (
                    math.sin(tt_angle)
                    - truck_model.hitch_v
                    / truck_model.wheel_base
                    * tan_steer
                    * math.cos(tt_angle)
                )
            pose.tyaw = normalize_angle(angle_t)
            pose.tx = (
                pose.x - truck_model.hitch_t * math.cos(pose.tyaw) - truck_model.hitch_v * math.cos(pose.yaw)
            )
            pose.ty = (
                pose.y - truck_model.hitch_t * math.sin(pose.tyaw) - truck_model.hitch_v * math.sin(pose.yaw)
            )
            pose.tx = round(pose.tx, 3)
            pose.ty = round(pose.ty, 3)
            pose.tyaw = round(pose.tyaw, 3)


@dataclass
class PointIndexOnLanelet:
    """表示点在车道线上的索引位置"""
    index: int
    is_projection_ahead: bool


def get_point_lanelet_index(point: BasicPoint3d, lanelet: Lanelet) -> PointIndexOnLanelet:
    """
    计算点在车道线上的投影位置

    Args:
        point: lanelet2的BasicPoint3d点
        lanelet: lanelet2的ConstLanelet对象

    Returns:
        PointIndexOnLanelet: 包含最近点索引和投影方向
    """
    # 获取车道中心线
    line = lanelet.centerline
    closest_idx = 0
    min_dist = float('inf')

    # 使用lanelet2的geometry模块计算距离
    for i in range(len(line)):
        dist = lanelet2.geometry.distance(line[i], point)
        if dist < min_dist:
            min_dist = dist
            closest_idx = i

    # 获取车道线角度
    lanelet_angle = get_point_angle(lanelet, closest_idx)

    # 计算点到最近点的角度
    ab_angle = np.arctan2(
        point.y - line[closest_idx].y,
        point.x - line[closest_idx].x
    )

    # 计算角度差并归一化
    angle_diff = normalize_angle(ab_angle - lanelet_angle)
    is_projection_ahead = bool(abs(angle_diff) > np.pi / 2)

    return PointIndexOnLanelet(closest_idx, is_projection_ahead)


def get_point_angle(lanelet: Lanelet, idx: int) -> float:
    """
    获取车道线在指定点的角度

    Args:
        lanelet: 车道线对象
        idx: 点的索引

    Returns:
        角度（弧度）
    """
    line = lanelet.centerline
    if idx < len(line) - 1:
        return np.arctan2(
            line[idx + 1].y - line[idx].y,
            line[idx + 1].x - line[idx].x
        )
    else:
        return np.arctan2(
            line[idx].y - line[idx - 1].y,
            line[idx].x - line[idx - 1].x
        )

def get_vec_point_angle(line, idx: int) -> float:
    if idx < len(line) - 1:
        return np.arctan2(
            line[idx + 1][1] - line[idx][1],
            line[idx + 1][0] - line[idx][0]
        )
    else:
        return np.arctan2(
            line[idx][1] - line[idx - 1][1],
            line[idx][0] - line[idx - 1][0]
        )


def normalize_angle(angle: float) -> float:
    """
    将角度归一化到 [-pi, pi] 范围内
    """
    return np.mod(angle + np.pi, 2 * np.pi) - np.pi


class Routing:
    def __init__(self, map_path: str, gen_graph: bool = True):

        self.map = load_map(map_path)

        routing_cost = lanelet2.routing.RoutingCostDistance(0)
        traffic_rules = lanelet2.traffic_rules.create(
            lanelet2.traffic_rules.Locations.Germany, lanelet2.traffic_rules.Participants.Vehicle)
        if gen_graph:
            self.routing_graph = lanelet2.routing.RoutingGraph(self.map, traffic_rules, [routing_cost])
        else:
            self.routing_graph = None

    def gen_query(self, ids):
        ids2 = [f"L_ID={lid}" for lid in ids]
        return " or ".join(ids2)

    def shortest_path(self, start, end):
        return [i.id for i in self.routing_graph.shortestPath(self.get_lanelet(start), self.get_lanelet(end), 0, False)]

    def linear_interpolation(self, line, dt=0.3) -> list[Pose]:
        interpolated_list = []

        for idx in range(len(line) - 1):
            current_point = line[idx]
            next_point = line[idx + 1]
            dx = next_point.x - current_point.x
            dy = next_point.y - current_point.y
            segment_length = math.hypot(dx, dy)
            t = 0
            interval = min(segment_length, dt)
            while t < segment_length:
                ratio = t / segment_length
                new_x = current_point.x + dx * ratio
                new_y = current_point.y + dy * ratio
                interpolated_point = BasicPoint3d(new_x, new_y, 0.0)
                interpolated_list.append(Pose.from_point(interpolated_point))
                t += interval

        last_point = interpolated_list[-1]
        last_line_point = line[-1]
        if point_distance(Pose.from_point(last_line_point), last_point) < 0.01:
            interpolated_list[-1] = Pose(last_line_point.x, last_line_point.y, 0.0)
        else:
            interpolated_list.append(Pose.from_point(last_line_point))

        return interpolated_list

    def get_lanelet(self, id: int):
        return self.map.laneletLayer[id]

    def get_lanelet_by_point(self, point: tuple[float, float]):
        pass

    def get_end_point(self, route_data):
        g_end = route_data["global_destination"]
        point_t = lanelet2.geometry.project(
            self.get_lanelet(g_end["id"]).centerline,
            BasicPoint3d(g_end["x"], g_end["y"])
        )
        return point_t

    def get_point_by_lanelets(self, lanelets: list[Lanelet]) -> list[Pose]:
        points: list[Pose] = []
        for l in lanelets:
            for p in l.centerline:
                points.append(Pose(p.x, p.y, 0.0, l))
        return points

    def parse_route_graph(self, route_data: dict, now_pos: Pose) -> tuple[list[Pose], bool]:
        start_point = route_data["route_waypoints"][0]
        end_point = route_data["route_waypoints"][1]

        nodes = route_data["route_graph"]["nodes"]
        if not nodes:
            logger.info("No nodes found in route graph")
            return [], False

        nodes = sorted(nodes, key=lambda x: x["node_index"])
        route_data["route_graph"]["nodes"] = nodes

        is_change, road_from, road_to, lcp = self.should_lange_change(route_data)

        if is_change:
            logger.info(f"Lane change detected from {road_from} to {road_to} at LCP {lcp}")
            path = self.gen_short_path_lane_change(
                self.get_lanelet(road_from),
                self.get_lanelet(road_to),
                lcp,
                Pose(route_data["route_waypoints"][0]["x"], route_data["route_waypoints"]
                     [0]["y"], route_data["route_waypoints"][0]["theta"])
            )
            generate_trailer_pose(path, now_pos.tyaw)
            return path, is_change

        else:
            # nodes 可能会多给
            nodes_t = nodes[start_point["node_index"]:end_point["node_index"] + 1]
            path_short = []
            for i, node in enumerate(nodes_t):
                llt = self.map.laneletLayer[node["lane_id"]]
                path_short.extend(self.get_point_path_by_lanelet(llt, node["start_s"], BasicPoint3d(
                    end_point["x"], end_point["y"]), is_last=(i == len(nodes_t) - 1)))

            generate_trailer_pose(path_short, now_pos.tyaw)
            return path_short, is_change

    def parse_demo_path(self, path_data: dict) -> list[Pose]:
        start = path_data["start_pose"]
        end = path_data["end_pose"]
        path_t = []
        for id_str in path_data["path"]:
            id = int(id_str)
            llt = self.map.laneletLayer[id]
            if id_str == path_data["path"][0]:
                start_p = BasicPoint3d(start["x"], start["y"])
            else:
                start_p = None
            if id_str == path_data["path"][-1]:
                end_p = BasicPoint3d(end["x"], end["y"])
            else:
                end_p = None
            path_short = self.get_point_path_by_lanelet_for_demo(llt, start_p, end_p)
            path_t.extend(path_short)
        return path_t

    def should_lange_change(self, route_data: dict) -> tuple[bool, int, int, float]:
        nodes = route_data["route_graph"]["nodes"]
        long_path_seqs = route_data["global_lane_sequence"]
        node_start = nodes[0]
        if "type" in node_start and node_start["type"] == "from":
            to_index = None
            if node_start["left_neighbor"]:
                to_index = node_start["left_neighbor"][0]
            elif node_start["right_neighbor"]:
                to_index = node_start["right_neighbor"][0]
            else:
                return False, None, None, None

            to_node = None
            for i in nodes:
                if i["node_index"] == to_index:
                    to_node = i
                    break

            lcp = None
            for i in long_path_seqs:
                if i["id"] == node_start["lane_id"]:
                    lcp = i["lcp"]
                    break
            return True, node_start["lane_id"], to_node["lane_id"], lcp
        return False, None, None, None

    def get_point_by_distance(self, llt, distance: float) -> BasicPoint3d:
        return lanelet2.geometry.interpolatedPointAtDistance(llt.centerline, distance)

    def gen_short_path_lane_change(self, road_from: Lanelet, road_to: Lanelet, lcp: float, pose_now: Pose):

        LEN_CHANGE = 32
        _point_now = lanelet2.geometry.project(road_from.centerline, lanelet2.core.BasicPoint3d(pose_now.x, pose_now.y))
        distance_now = lanelet2.geometry.distance(road_from.centerline[0], _point_now)
        start_change_dis = (distance_now + lcp) / 2
        _point_start_change = lanelet2.geometry.interpolatedPointAtDistance(road_from.centerline, start_change_dis)

        _point_len_chnage_on_from = lanelet2.geometry.interpolatedPointAtDistance(
            road_from.centerline, start_change_dis + LEN_CHANGE)
        _point_end_change = lanelet2.geometry.project(road_to.centerline, _point_len_chnage_on_from)

        width_of_road = lanelet2.geometry.distance(_point_end_change, _point_len_chnage_on_from)

        mid_dis = start_change_dis + LEN_CHANGE / 2
        _point_mid_change_from = lanelet2.geometry.interpolatedPointAtDistance(road_from.centerline, mid_dis)
        _point_mid_change_to = lanelet2.geometry.interpolatedPointAtDistance(road_to.centerline, mid_dis)

        bezier_points = np.array([
            [_point_start_change.x, _point_start_change.y],
            [_point_mid_change_from.x, _point_mid_change_from.y],
            [_point_mid_change_to.x, _point_mid_change_to.y],
            [_point_end_change.x, _point_end_change.y]
        ])

        print(f"use point: {bezier_points}")
        path_points = bezier_curve(bezier_points, num=50)

        path_raw = []
        for x, y in path_points:
            path_raw.append(Pose(float(x), float(y), 0.0))

        print(f"genarate bezier path: {path_raw}")
        path_direct = self.get_point_path_by_lanelet(road_from, distance_now, start_change_dis)
        print(f"genarate dir path: {path_direct}")
        path_rs = path_direct + path_raw
        self.add_angle_for_path(path_rs)
        return path_rs

    def get_nearest_index(self, line: list[Pose], p: BasicPoint3d) -> int:
        nearest_index = 0
        min_dist = float('inf')

        for i, line_p in enumerate(line):
            current_dist = point_distance(line_p, p)
            if current_dist < min_dist:
                min_dist = current_dist
                nearest_index = i
        return nearest_index

    def get_nearest_index_by_dis(self, line: list[Pose], end_dis: float) -> int:
        count_length = 0
        end_idx = None
        find_end = False
        for idx in range(len(line) - 1):
            current_point = line[idx]
            next_point = line[idx + 1]
            dx = next_point.x - current_point.x
            dy = next_point.y - current_point.y
            segment_length = math.hypot(dx, dy)
            count_length += segment_length

            if end_idx is None and count_length >= end_dis:
                end_idx = idx
                find_end = True
                break
        if not find_end:
            end_idx = len(line) - 1
        return end_idx

    def get_point_path_by_lanelet(self, lanelet: Lanelet, start: float, end: float | BasicPoint3d, is_last=False) -> list:
        line = lanelet.centerline
        line_inter = self.linear_interpolation(line)
        count_length = 0
        start_idx = None
        for idx in range(len(line_inter) - 1):
            current_point = line_inter[idx]
            next_point = line_inter[idx + 1]
            dx = next_point.x - current_point.x
            dy = next_point.y - current_point.y
            segment_length = math.hypot(dx, dy)
            count_length += segment_length

            if start_idx is None and count_length >= start:
                start_idx = idx

        if isinstance(end, float):
            end_index = self.get_nearest_index_by_dis(line_inter, end)
            path = line_inter[start_idx:end_index + 1] if start_idx is not None and end_index is not None else []
        else:
            end_index = self.get_nearest_index(line_inter, end)
            path = line_inter[start_idx:end_index + 1] if start_idx is not None and end_index is not None else []

        self.add_angle_for_path(path)
        return path

    def get_point_path_by_lanelet_for_demo(self, lanelet: Lanelet, start: BasicPoint3d | None, end: BasicPoint3d | None, is_last=False) -> list:
        line = lanelet.centerline
        line_inter = self.linear_interpolation(line)
        if start is None:
            satrt_index = 0
        else:
            satrt_index = self.get_nearest_index(line_inter, start)
        if end is None:
            end_index = len(line_inter) - 1
        else:
            end_index = self.get_nearest_index(line_inter, end)
        path = line_inter[satrt_index:end_index + 1] if satrt_index is not None and end_index is not None else []
        self.add_angle_for_path(path)
        return path

    def add_angle_for_path(self, points: list[Pose]):
        for i in range(len(points)):
            cur = points[i]
            if i == len(points) - 1:
                p1 = points[i - 1]
                p2 = cur
            else:
                p1 = cur
                p2 = points[i + 1]
            cur.yaw = math.atan2(p2.y - p1.y, p2.x - p1.x)

    def show_point(self, point: BasicPoint3d):
        return f"{round(point.x, 3)}, {round(point.y, 3)}"

    def trans_path(self, path):
        start_pose = BasicPoint3d(path["start_pose"]["x"], path["start_pose"]["y"])
        end_pose = BasicPoint3d(path["end_pose"]["x"], path["end_pose"]["y"])
        start_idx_info = get_point_lanelet_index(start_pose, self.get_lanelet(int(path["path"][0])))
        end_idx_info = get_point_lanelet_index(end_pose, self.get_lanelet(int(path["path"][-1])))
        path["start_pose"]["index"] = start_idx_info.index
        path["end_pose"]["index"] = end_idx_info.index
        path["start_pose"]["is_ahead"] = start_idx_info.is_projection_ahead
        path["end_pose"]["is_ahead"] = end_idx_info.is_projection_ahead
        return path

def process_path(_):
    rs = g_routing.parse_demo_path(sa_1)
    return rs


def test_parse():
    t1 = time.time()
    rs = g_routing.parse_demo_path(sa_1)
    t2 = time.time()
    print(f"cost time: {1000 * (t2 - t1)} ms")
    print(len(rs))


def test_req_path():
    url = "http://127.0.0.1:8088/api/v1/tool/to_point_path"
    data = {"AT001": sa_1}
    import requests
    t1 = time.time()
    rs = requests.post(url, json=data)
    t2 = time.time()
    print(f"cost time: {1000 * (t2 - t1)} ms")
    print(rs.text)
    print("??")
    print(rs.status_code)


if __name__ == "__main__":
    # test_req_path()
    # t = g_routing.trans_path(l)
    # print(t)
    pass
