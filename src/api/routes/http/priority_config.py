#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/7/31
# @Author: simon
# @File: priority_config.py.py
# @Software: PyCharm
# @Description: 优化系数配置
import math
from chain_model.model import StdRes
from fastapi import APIRouter, Body
import json
from src.middlewares.redis_handler.connect import redis_cli


router = APIRouter()

KEY = "pp4:priority_config:simweb"


@router.get('/query', description="查询优先级配置")
async def query():
    data = json.loads(s) if (s := await redis_cli.get(KEY)) else None
    return StdRes(data=data)


@router.post('/update', description="更新优先级配置")
async def update(req: dict = Body()):
    await redis_cli.set(KEY, json.dumps(req))
    return StdRes()
