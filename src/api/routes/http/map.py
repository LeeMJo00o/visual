from chain_model.model import StdRes
from fastapi import APIRouter, Body, Response
from src.core.config import MAP_NAME
import json
from src.map_tools import export_osm_svg, export_osm_path_info
import os

router = APIRouter()


@router.post('/svg')
def get_svg():
    map_path = f"map/{MAP_NAME}"
    svg_file = f"map/raw_{MAP_NAME}.svg"

    # 检查文件是否存在
    if os.path.exists(svg_file):
        pass
    else:
        export_osm_svg(map_path)

    with open(svg_file, 'r') as f:
        svg_content = f.read()

    return Response(svg_content, media_type='image/svg+xml')


def get_config_by_prefix(config_map: dict, src: str) -> dict:
    for k, v in config_map.items():
        if src.startswith(k):
            return v


@router.post('/config')
def get_config():
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
    }
    return get_config_by_prefix(config_map, MAP_NAME)


@router.post('/path_info')
def get_path_info():
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
