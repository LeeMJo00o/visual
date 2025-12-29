#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/12/29
# @Author: simon
# @File: arbiter.py 
# @Software: PyCharm
# @Description:
import time
from chain_model.model import StdRes
from fastapi import APIRouter, Body
from src.core.config import pp_visual_ARBITER_CLEAR_AREA_URL
from src.core.log import logger
from chain_http import aio_http

router = APIRouter()



@router.post("/clear")
async def update_dynamic_weight_ratio(req: dict = Body()) -> StdRes:
    logger.info(f"arbiter clear area, data={req}")

    # 请求scenario - 触发重规划
    url = pp_visual_ARBITER_CLEAR_AREA_URL
    params = {
        "id": req.get("vehicle_id"),
        "timestamp": time.time()
    }
    logger.info(f"request arbiter, url={url}, params={params}")
    res = await aio_http.post(url, params=params, timeout=5)
    logger.info(f"request arbiter response: {params} => {res.status, res.text}")
    if res.status:
        return StdRes()
    else:
        return StdRes(code=100)