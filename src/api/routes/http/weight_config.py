#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/7/31
# @Author: simon
# @File: weight_config.py.py
# @Software: PyCharm
# @Description: 权重系数配置
import math

from chain_model.model import StdRes
from fastapi import APIRouter, Body
import json
from src.middlewares.redis_handler.connect import redis_cli


router = APIRouter()

KEY = "pp4:weight_scale_config:simweb"
KEY_PP4_NPA_SCALE_SIMWEB = "pp4:npa_scale:simweb"
KEY_PP4_BS_CURVE_SCALE_SIMWEB = "pp4:bs_curve_scale:simweb"
KEY_PP4_STACK_BUSY_SCALE_SIMWEB = "pp4:stack_busy_scale:simweb"
KEY_PP4_STACK_CROWDED_SCALE_SIMWEB = "pp4:stack_crowded_scale:simweb"


async def _get_float(key: str, default: float = 0) -> float | str:
    v = float(s) if (s := await redis_cli.get(key)) else default
    return "inf" if math.isinf(v) else v


@router.get('/query', description="查询权重配置")
async def query():
    weightConfigData = json.loads(s) if (s := await redis_cli.get(KEY)) else None
    NPA_SCALE = await _get_float(KEY_PP4_NPA_SCALE_SIMWEB, float("inf"))
    BS_CURVE_SCALE = await _get_float(KEY_PP4_BS_CURVE_SCALE_SIMWEB, 10)
    STACK_BUSY_BUSY_SCALE = await _get_float(KEY_PP4_STACK_BUSY_SCALE_SIMWEB, 1)
    STACK_BUSY_CROWDED_SCALE = await _get_float(KEY_PP4_STACK_CROWDED_SCALE_SIMWEB, 2)
    data = {
        "weightConfigData": weightConfigData,
        "NPA_SCALE": NPA_SCALE,
        "BS_CURVE_SCALE": BS_CURVE_SCALE,
        "STACK_BUSY_BUSY_SCALE": STACK_BUSY_BUSY_SCALE,
        "STACK_BUSY_CROWDED_SCALE": STACK_BUSY_CROWDED_SCALE,
    }
    return StdRes(data=data)


@router.post('/update', description="更新权重配置")
async def update(req: dict = Body()):
    async with redis_cli.pipeline() as pipe:
        await pipe.set(KEY, json.dumps(req.get("weightConfigData")))
        await pipe.set(KEY_PP4_NPA_SCALE_SIMWEB, req.get("NPA_SCALE"))
        await pipe.set(KEY_PP4_BS_CURVE_SCALE_SIMWEB, req.get("BS_CURVE_SCALE"))
        await pipe.set(KEY_PP4_STACK_BUSY_SCALE_SIMWEB, req.get("STACK_BUSY_BUSY_SCALE"))
        await pipe.set(KEY_PP4_STACK_CROWDED_SCALE_SIMWEB, req.get("STACK_BUSY_CROWDED_SCALE"))
        await pipe.execute()
    return StdRes()
