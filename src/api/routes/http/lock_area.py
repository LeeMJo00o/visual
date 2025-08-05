#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/7/28
# @Author: simon
# @File: lock_area.py
# @Software: PyCharm
# @Description:
from chain_model.model import StdRes
from fastapi import APIRouter, Body
import json
from src.middlewares.redis_handler.connect import redis_cli


router = APIRouter()

KEYS = {
    "lock": "pp4:lock_area:simweb",
    "limit": "pp4:limit_area:simweb",
    "trigger": "pp4:trigger_area:simweb",
}

# {"name":"lock_area_1751455131293","subtype":"lock","type":"lock","created_by":"pp-visual","describe":"","polygon":[{"x":1449.7863,"y":1769.692},{"x":712.9327,"y":543.7826},{"x":198.9195,"y":852.739},{"x":935.7731,"y":2078.6483},{"x":1449.7863,"y":1769.692}]}
def get_key(type: str) -> str:
    return KEYS.get(type)

@router.post('/add_update_lock_area')
async def add_update_lock_area(req: dict = Body()):
    type = req["type"]
    areaData = req["area_data"]
    name = areaData["name"]
    key = get_key(type)
    await redis_cli.hset(key, name, json.dumps(areaData))
    return StdRes()

@router.post('/del_lock_area')
async def del_lock_area(req: dict = Body()):
    type = req["type"]
    area_id = req["area_id"]
    key = get_key(type)
    await redis_cli.hdel(key, area_id)
    return StdRes()