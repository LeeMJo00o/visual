import datetime
import json
import math
import uuid


def get_unique_id() -> str:
    return str(uuid.uuid1())


def load_json(file_path: str):
    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def gen_josm_query_string(lane_ids: list[int]):
    ids2 = [f"L_ID={i}" for i in lane_ids]
    return " or ".join(ids2)


def euclidean_distance(pose1: dict, pose2: dict) -> float:
    return math.sqrt((pose1["x"] - pose2["x"])**2 + (pose1["y"] - pose2["y"])**2)


def kv_hash_to_json(s: dict) -> dict:
    rs = {}
    for key, value in s.items():
        value_t = json.loads(value)
        if key:
            rs[key] = value_t
    return rs
