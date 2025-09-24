#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/9/24
# @Author: simon
# @File: map_info.py 
# @Software: PyCharm
# @Description: 启动时将地图信息写入redis
import asyncio
import json

from src.core.config import MAP_NAME
from src.core.log import logger
from src.middlewares.redis_handler.connect import redis_cli


async def save_map_info():
    while True:
        try:
            data = {"mapName": MAP_NAME}
            await redis_cli.set("pp4:map_info", json.dumps(data))
            logger.info(f"save map info to redis success: {data}")
            break
        except Exception as e:
            logger.info(f"save map info to redis err: {e}")
        finally:
            await asyncio.sleep(3)