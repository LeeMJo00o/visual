import traceback

from chain_model.model import StdRes
from fastapi import APIRouter, Body, Response
from src.core.config import MAP_NAME, pp_visual_DEVICE_MODE
import json

from src.entity.MapInfo import MapInfo
from src.map_tools import export_osm_path_info
import os
from src.middlewares.redis_handler.connect import redis_cli, redis_cli_fms
from src.core.config import PATH_REPORT_URL
from src.core.log import logger
from chain_http import aio_http
from src.api.routes.websocket.route import PathWsServer

router = APIRouter()


def get_config_by_prefix(config_map: dict, src: str) -> dict:
    _src = src.lower()
    for k, v in config_map.items():
        if _src.startswith(k):
            return v
    return config_map.get("default")


@router.post('/config')
async def get_config(req: MapInfo):
    map_name = req.mapName
    config_map = {
        "default": {
            "rotation": 0,
            "offset": [0, 0],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 1.0,
            "mode": "test-demo",
            "version": map_name
        },
        "abuzhabi": {
            "rotation": -2.471,
            "offset": [450, 330],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 1.0,
            "mode": "test-my-pp",
            "version": map_name
        },
        "mapsingapore": {
            "rotation": -2.112,
            "offset": [990, 198],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 0.355166,
            "mode": "test-demo",
            "version": map_name
        },
        "fangzhen": {
            "rotation": -2.112,
            "offset": [990, 198],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 0.355166,
            "mode": "test-demo",
            "version": map_name
        },
        "taiguo": {
            "rotation": 0.292,
            "offset": [761, 612],
            "use_back_image": True,
            "offset_back_image": [-1131.5, -203.5],
            "scale_back": 0.28230378433981407,
            "back_image_file": "taiguo.png",
            "scale": 1.31,
            "mode": "test-demo",
            "version": map_name
        },
        "tangshan": {
            "rotation": 0,
            "offset": [350, 650],
            "use_back_image": False,
            "scale": 0.8,
            "mode": "test-demo",
            "version": map_name
        },
        "malaysia": {
            "rotation": 1.047,
            "offset": [1000, 400],
            "use_back_image": False,
            "scale": 0.2,
            "mode": "test-demo",
            "version": map_name
        },
        "malaixiya": {
            "rotation": 1.047,
            "offset": [1000, 400],
            "use_back_image": False,
            "scale": 0.2,
            "mode": "test-demo",
            "version": map_name
        },
        "taipingyang": {
            "rotation": 0,
            "offset": [400, 600],
            "use_back_image": False,
            "scale": 0.7,
            "mode": "test-demo",
            "version": map_name
        },
        "uk": {
            "rotation": -0.64,
            "offset": [600, 500],
            "use_back_image": False,
            "scale": 0.8,
            "mode": "test-demo",
            "version": map_name
        },
        "luzhou": {
            "rotation": 0.872,
            "offset": [200, 100],
            "use_back_image": False,
            "scale": 0.6,
            "mode": "test-demo",
            "version": map_name
        },
        "fuzhou": {
            "rotation": -0.447,
            "offset": [600,350],
            "use_back_image": False,
            "scale": 0.4,
            "mode": "test-demo",
            "version": map_name
        },
    }

    return get_config_by_prefix(config_map, map_name)


@router.post('/path_info')
async def get_path_info(req: MapInfo):
    map_name = req.mapName

    map_path = f"map/{map_name}"
    path_file = f"map/raw_path_{map_name}.json"

    # 检查文件是否存在
    if os.path.exists(path_file):
        pass
    else:
        export_osm_path_info(map_path)

    with open(path_file, "r") as f:
        path_info = json.load(f)
    return path_info


@router.post("/change_weight")
async def change_weight(req: dict = Body()) -> StdRes:
    url = f"{PATH_REPORT_URL}/api/chain/execute-chain"
    req = {
        "id": "wf_update_routing_weight",
        "req_data": {
            "weight": float(req["value"])
        }
    }
    res = await aio_http.post(url, json=req, timeout=5)
    logger.info(f"weight change: {req} => {res.status, res.text}")
    return StdRes()


@router.get("/query/dynamic_weight_ratio")
async def query_dynamic_weight_ratio() -> StdRes:
    NAME = f"CONFIG:PP:{pp_visual_DEVICE_MODE}:WELLROUTING"
    KEY = "wellrouting_GRAPH_DYNAMIC_WEIGHT_RATIO"
    V = await redis_cli_fms.hget(NAME, KEY)
    v = float(V) if V is not None else 0
    logger.info(f"query dynamic weight ratio, value={v}")
    return StdRes(data=v)


@router.post("/update/dynamic_weight_ratio")
async def update_dynamic_weight_ratio(req: dict = Body()) -> StdRes:
    logger.info(f"update dynamic weight ratio, data={req}")
    NAME = f"CONFIG:PP:{pp_visual_DEVICE_MODE}:WELLROUTING"
    KEY = "wellrouting_GRAPH_DYNAMIC_WEIGHT_RATIO"
    v = req["value"]
    await redis_cli_fms.hset(NAME, KEY, v)

    # 请求scenario - 触发重规划
    url = f"{PATH_REPORT_URL}/api/chain/execute-chain"
    req = {
        "id": "wf_update_routing_weight",
        "req_data": {
            "weight": float(req["value"])
        }
    }
    res = await aio_http.post(url, json=req, timeout=5)
    logger.info(f"[scenario]weight change: {req} => {res.status, res.text}")

    return StdRes()

@router.post("/reload_window")
async def reload_window(req: dict = Body()) -> StdRes:
    await PathWsServer.clear_display()
    return StdRes()


@router.post('/vpb_info')
async def get_vpb_info():
    """获取开启的vpb数据"""
    data = {}
    try:
        s = await redis_cli.get("pp4:vpbStatusData:fms")
        if s:
            data = json.loads(s)
    except:
        logger.error(f"get_vpb_info err: {traceback.format_exc()}")

    return data
