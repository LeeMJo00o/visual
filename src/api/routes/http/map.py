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

router = APIRouter()


def get_config_by_prefix(config_map: dict, src: str) -> dict:
    for k, v in config_map.items():
        if src.startswith(k):
            return v


@router.post('/config')
async def get_config():
    config_map = {
        "Abuzhabi_QP_VPB": {
            "rotation": -2.471,
            "offset": [450, 330],
            "scale": 1.0,
            "mode": "test-my-pp",
            "version": MAP_NAME
        },
        "MapSingapore": {
            "rotation": -2.112,
            "offset": [989.9776968593537, 198.52708238507054],
            "scale": 0.355166,
            "mode": "test-demo",
            "version": MAP_NAME
        },
        "fangzhen": {
            "rotation": -2.112,
            "offset": [989.9776968593537, 198.52708238507054],
            "scale": 0.355166,
            "mode": "test-demo",
            "version": MAP_NAME
        },
        "taiguo": {
            "rotation": 0.29,
            "offset": [768, 695],
            "scale": 1.319,
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

# {"name":"lock_area_1751455131293","subtype":"lock","type":"lock","created_by":"pp-visual","describe":"","polygon":[{"x":1449.7863,"y":1769.692},{"x":712.9327,"y":543.7826},{"x":198.9195,"y":852.739},{"x":935.7731,"y":2078.6483},{"x":1449.7863,"y":1769.692}]}


@router.post('/add_lock_area')
async def get_path_info(req: dict = Body()):
    key_simweb_lock = "pp4:lock_area:simweb"
    name = req["name"]
    await redis_cli.hset(key_simweb_lock, name, json.dumps(req))
    return StdRes()


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
