#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/8/28
# @Author: simon
# @File: info.py 
# @Software: PyCharm
# @Description: 查询gzn系统相关的信息
import json
import math
from chain_http import aio_http
from chain_model.model import StdRes
from fastapi import APIRouter

from src.core.config import pp_visual_MAP_GRAPH_VERSION_URL, pp_visual_WELLROUTING_VERSION_URL

router = APIRouter()

# map graph
async def query_map_graph_version():
    data = {"module": "map_graph", "info": None, "msg": ""}
    try:
        response = await aio_http.get(pp_visual_MAP_GRAPH_VERSION_URL, timeout=5)
        if response.status == 200 and (res:=json.loads(response.text)).get("code") == 200:
            data["info"] = res.get("data", {})
        else:
            data["msg"] = f"error, http status: {response.status}"
    except Exception as e:
        data["msg"] = str(e)
    return data

# wellrouting
async def query_wellrouting_version():
    data = {"module": "wellrouting", "info": None, "msg": ""}
    try:
        response = await aio_http.get(pp_visual_WELLROUTING_VERSION_URL, timeout=5)
        if response.status == 200 and (res:=json.loads(response.text)).get("code") == 0:
            data["info"] = res.get("data", {})
        else:
            data["msg"] = f"error, http status: {response.status}"
    except Exception as e:
        data["msg"] = str(e)
    return data


@router.get('/', description="查询地图及graph相关的版本信息")
async def query():
    # map_graph
    map_graph_info = await query_map_graph_version()
    # wellrouting
    wellrouting_info = await query_wellrouting_version()

    _list = [map_graph_info, wellrouting_info]
    infos = {item["module"]: item for item in _list}

    return StdRes(data=infos)
