#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/9/24
# @Author: simon
# @File: polygon.py 
# @Software: PyCharm
# @Description:
import asyncio
from chain_utils.asyncio_utils import RefTasks
from fastapi import APIRouter
from chain_websocket.server import ConnectionManager, MulLinkServerEndpoint
from src.middlewares.redis_handler.connect import redis_cli_arbiter as redis_cli
from src.core.log import logger
import traceback
from src.utils.tools import gzip_decompress_to_str


router = APIRouter()
_manager_self_area = ConnectionManager()
_manager_ga = ConnectionManager()
_manager_pga = ConnectionManager()
_manager_pla = ConnectionManager()

ref_tasks = RefTasks(logger_done=logger)


class PolygonWsServer(MulLinkServerEndpoint):
    ws_manager = _manager_self_area
    key = ""
    type = "polygon"
    subtype = ""

    async def on_receive_json(self, mess: dict):
        print(f"I receive mess: {mess}")

        # send message to the connection
        await self.websocket.send_json({
            "msg": "this is a mepublish_demo_pathsage for the one connection"
        })

        # braodcast message to all connections
        await self.broadcast_json({
            "msg_all": "this is a mesage for the all connections"
        })

    @classmethod
    async def get_data(cls) -> dict[str, str]:
        try:
            if not cls.key or not redis_cli: return {}

            data = await redis_cli.hgetall(cls.key)

            if not data: return {}

            # 解压数据
            return {str(k.decode("utf-8")): gzip_decompress_to_str(v) for k, v in data.items()}
        except:
            logger.error(f"polygon[{cls.type}][{cls.subtype}] "
                         f"get redis data err: {traceback.format_exc()}")
        return {}

    @classmethod
    async def publish_data(cls):
        while True:
            try:
                data = await cls.get_data()
                await cls.ws_manager.broadcast_json({
                    "type": cls.type,
                    "subtype": cls.subtype,
                    "data": data
                })
            except Exception as e:
                logger.error(f"publish_lock_area error: {repr(e)}, {e} {traceback.format_exc()}")
            await asyncio.sleep(1)


@router.websocket_route("/self_area", name="websocket for polygon - self area")
class SelfAreaWsServer(PolygonWsServer):
    ws_manager = _manager_self_area
    key = "self_area_polygon"
    type = "polygon"
    subtype = "self_area"


@router.websocket_route("/ga", name="websocket for polygon - ga")
class GaWsServer(PolygonWsServer):
    ws_manager = _manager_ga
    key = "ga_polygon"
    type = "polygon"
    subtype = "ga"


@router.websocket_route("/pga", name="websocket for polygon - pga")
class PgaWsServer(PolygonWsServer):
    ws_manager = _manager_pga
    key = "pga_polygon"
    type = "polygon"
    subtype = "pga"


@router.websocket_route("/pla", name="websocket for polygon - pla")
class PlaWsServer(PolygonWsServer):
    ws_manager = _manager_pla
    key = "pla_polygon"
    type = "polygon"
    subtype = "pla"


async def start_polygon_ws():
    ref_tasks << SelfAreaWsServer.publish_data()
    ref_tasks << GaWsServer.publish_data()
    ref_tasks << PgaWsServer.publish_data()
    ref_tasks << PlaWsServer.publish_data()
