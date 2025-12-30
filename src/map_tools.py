import os
from .routing import Routing
import json
import math
import numpy as np
from .routing import PointIndexOnLanelet, vec_point_distance, get_vec_point_angle, normalize_angle, MAP_NAME


def export_osm_path_info(osm_file: str):
    dir_path = os.path.dirname(osm_file)
    osm_file_name = os.path.basename(osm_file)
    to_raw_path = os.path.join(dir_path, f"raw_path_{osm_file_name}.json")
    routing = Routing(osm_file, gen_graph=False)
    map_info = {}
    llts = lanelet_filter(routing.map.laneletLayer)
    for llt in llts:
        road_info = {
            "attrs": {},
            "points": [],
        }
        road_info["attrs"] = {k: v for k, v in llt.attributes.items()}

        if road_info.get("is_straight"):
            for p in llt.centerline:
                road_info["points"].append([round(p.x, 3), round(p.y, 3)])
        else:
            last_p = None
            for p in llt.centerline:
                if last_p:
                    dis = math.sqrt((p.x - last_p.x)**2 + (p.y - last_p.y)**2)
                    if dis > 0.8:
                        road_info["points"].append([round(p.x, 3), round(p.y, 3)])
                        last_p = p
                else:
                    road_info["points"].append([round(p.x, 3), round(p.y, 3)])
                    last_p = p
            if last_p != llt.centerline[-1]:
                road_info["points"].append([round(llt.centerline[-1].x, 3), round(llt.centerline[-1].y, 3)])
        map_info[llt.id] = road_info

    # area - junction
    for area in routing.map.polygonLayer:
        if "subtype" in area.attributes and area.attributes["subtype"] == "no_stop_area":
            continue
        if not ("area" in area.attributes and area.attributes["area"] == "true"):
            continue
            # specialtype=junction或pp_active=true 都解析为junction进行使用
        if ("specialtype" in area.attributes and area.attributes["specialtype"] == "junction") \
                or ("pp_active" in area.attributes and area.attributes["pp_active"] == "true"):
            road_info = {
                "attrs": {},
                "points": [[round(p.x, 3), round(p.y, 3)] for p in area],
            }
            map_info[f"junction_{area.id}"] = road_info

    with open(to_raw_path, "w") as f:
        json.dump(map_info, f, separators=(',', ':'))


def lanelet_filter(llt_s):
    t = []
    for llt in llt_s:
        if "drivable" in llt.attributes and llt.attributes["drivable"].lower() == "false":
            continue
        # 过滤 road_type=scanline的lanelet
        if "road_type" in llt.attributes and llt.attributes["road_type"].lower() == "scanline":
            continue
        t.append(llt)
    return t


class Roads():
    def __init__(self) -> None:
        self.road_info = self.get_path_info()

    def get_point_road_index(self, point: tuple, lanelet_id: str) -> PointIndexOnLanelet:
        line = self.road_info[lanelet_id]["points"]
        closest_idx = 0
        min_dist = float('inf')

        # 使用lanelet2的geometry模块计算距离
        for i, point_line in enumerate(line):
            dist = vec_point_distance(point_line, point)
            if dist < min_dist:
                min_dist = dist
                closest_idx = i

        # 获取车道线角度
        lanelet_angle = get_vec_point_angle(line, closest_idx)

        # 计算点到最近点的角度
        ab_angle = np.arctan2(
            point[1] - line[closest_idx][1],
            point[0] - line[closest_idx][0]
        )

        # 计算角度差并归一化
        angle_diff = normalize_angle(ab_angle - lanelet_angle)
        is_projection_ahead = bool(abs(angle_diff) > np.pi / 2)

        return PointIndexOnLanelet(closest_idx, is_projection_ahead)

    def get_path_info(self):
        map_path = f"map/{MAP_NAME}"
        path_file = f"map/raw_path_{MAP_NAME}.json"

        # 检查文件是否存在
        if os.path.exists(path_file):
            pass
        else:
            export_osm_path_info(map_path)

        with open(path_file, "r") as f:
            path_info = json.load(f)
        return path_info


# g_routing = Routing(f"map/{MAP_NAME}", gen_graph=False)
g_roads = Roads()


if __name__ == "__main__":
    # routing = Routing(f"map/Abuzhabi_QP_VPB_250509_V3.7.3.osm", gen_graph=False)
    # to_file = "map/map.json"
    # save_to_json(osm_to_json(routing), to_file)
    # svg, _errorCurvatureInfoList = getSvgString(
    #     to_file,
    # )
    # with open("map/map.svg", "w") as f:
    #     f.write(svg)
    # export_osm_svg("map/MexicoMap_20250626V9.0.osm")
    g_roads.get_path_info()
