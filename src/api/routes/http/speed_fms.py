#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/8/26
# @Author: simon
# @File: speed_fms.py 
# @Software: PyCharm
# @Description: 从redis读取fms设置的速度配置数据
import math
from chain_model.model import StdRes
from fastapi import APIRouter
import json
from src.middlewares.redis_handler.connect import redis_cli


router = APIRouter()

KEY = "pp4:speed:fms"


@router.get('/query', description="查询fms速度配置")
async def query():
    data = json.loads(s) if (s := await redis_cli.get(KEY)) else None
    return StdRes(data=data)
