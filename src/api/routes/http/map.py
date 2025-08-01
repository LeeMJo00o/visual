from chain_model.model import StdRes
from fastapi import APIRouter, Body, Response
from src.core.config import MAP_NAME
import json
from src.map_tools import export_osm_path_info
import os
from src.middlewares.redis_handler.connect import redis_cli
from src.core.config import PATH_REPORT_URL
from src.core.log import logger
from chain_http import aio_http
from src.api.routes.websocket.route import PathWsServer

router = APIRouter()


def get_config_by_prefix(config_map: dict, src: str) -> dict:
    for k, v in config_map.items():
        if src.startswith(k):
            return v
    return config_map.get("default")


@router.post('/config')
async def get_config():
    config_map = {
        "default": {
            "rotation": 0,
            "offset": [0, 0],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 1.0,
            "mode": "test-demo",
            "version": MAP_NAME
        },
        "Abuzhabi_QP_VPB": {
            "rotation": -2.471,
            "offset": [450, 330],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 1.0,
            "mode": "test-my-pp",
            "version": MAP_NAME
        },
        "MapSingapore": {
            "rotation": -2.112,
            "offset": [990, 198],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 0.355166,
            "mode": "test-demo",
            "version": MAP_NAME
        },
        "fangzhen": {
            "rotation": -2.112,
            "offset": [990, 198],
            "offset_back_image": [0, 0],
            "scale_back": 1,
            "scale": 0.355166,
            "mode": "test-demo",
            "version": MAP_NAME
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
            "version": MAP_NAME
        },
        "TangShan": {
            "rotation": 0,
            "offset": [500, 900],
            "use_back_image": False,
            "scale": 1.2,
            "mode": "test-demo",
            "version": MAP_NAME
        }
    }

    return get_config_by_prefix(config_map, MAP_NAME)


@router.post('/path_info')
async def get_path_info():
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


@router.post("/reload_window")
async def reload_window(req: dict = Body()) -> StdRes:
    await PathWsServer.clear_display()
    return StdRes()
