import binascii
import datetime
import gzip
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


def str_to_json(s: dict) -> dict:
    rs = {}
    for key, value in s.items():
        value_t = json.loads(value)
        if key:
            rs[key] = value_t
    return rs


def gzip_decompress_to_str(content: bytes|str, encoding: str = 'utf-8') -> str:
    """
    解压 gzip 压缩的内容并转为字符串，如果不是 gzip 压缩则尝试直接解码

    Args:
        content: 要解压的字节内容
        encoding: 解码使用的字符编码，默认为 'utf-8'

    Returns:
        解压/解码后的字符串

    Raises:
        UnicodeDecodeError: 当内容既不是 gzip 压缩也无法用指定编码解码时
    """
    if not content or not isinstance(content, bytes):
        if isinstance(content, bytes):
            return content.decode("utf-8")  # 空bytes转成空字符串
        return content
    # 检查是否是 gzip 压缩的内容 (gzip 文件头是 0x1f 0x8b)
    if content and len(content) > 2 and content[:2] == b'\x1f\x8b':
        try:
            decompressed = gzip.decompress(content)
            return decompressed.decode(encoding)
        except (gzip.BadGzipFile, binascii.Error, EOFError):
            # 如果解压失败，尝试直接解码
            return content.decode(encoding)

    # 不是 gzip 内容，直接尝试解码
    return content.decode(encoding)
