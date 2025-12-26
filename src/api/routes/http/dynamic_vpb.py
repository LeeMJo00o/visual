#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/12/23
# @Author: simon
# @File: dynamic_vpb.py 
# @Software: PyCharm
# @Description: 动态vpb相关的接口, 查询是否更新了, 以及获取当前的数据
import ujson as json
from chain_model.model import StdRes
from fastapi import APIRouter
from src.core.config import pp_visual_DEVICE_MODE as DEVICE_MODEL
from src.middlewares.redis_handler.connect import redis_cli

router = APIRouter()
hash_key = f"map_graph:dynamic:vpb:hash:{DEVICE_MODEL}"
data_key = f"map_graph:dynamic:vpb:data:{DEVICE_MODEL}"


@router.get('/query/last/version', description="查询当前的版本号")
async def version():
    version = await redis_cli.get(hash_key)
    if version is None:
        version = ""
    return StdRes(data=version)


@router.get('/query/data', description="获取当前的动态vpb数据")
async def data():
    async with redis_cli.pipeline(transaction=True) as pipeline:
        await pipeline.get(hash_key)
        await pipeline.get(data_key)
        version, data = await pipeline.execute()
    version = version if version is not None else ""
    data = json.loads(data) if data else []

    return StdRes(data={"version": version, "data": data})
