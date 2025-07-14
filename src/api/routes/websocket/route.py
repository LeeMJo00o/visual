import asyncio
import random
import math
import time
from fastapi import APIRouter
from fastapi import WebSocket
from chain_websocket.server import ConnectionManager, MulLinkServerEndpoint
from src.middlewares.mq import mq_route
import json
from src.middlewares.redis_handler.connect import redis_cli
from src.core.config import DEMO_REDIS_URL
from src.core.log import logger
import traceback
from src.map_tools import g_roads
from src.utils.tools import str_to_json

router = APIRouter()
_manager = ConnectionManager()
_manager_demo_path = ConnectionManager()
_manager_demo_short_path = ConnectionManager()
_manager_pose = ConnectionManager()
_manager_lock_area = ConnectionManager()
_manager_path = ConnectionManager()


@router.websocket_route("/route_info", name="websocket for pushlish route info")
class RouteWsServer(MulLinkServerEndpoint):
    ws_manager = _manager

    async def on_receive_json(self, mess: dict):
        print(f"I receive mess: {mess}")

        # send message to the connection
        await self.websocket.send_json({
            "msg": "this is a mesage for the one connection"
        })

        # braodcast message to all connections
        await self.broadcast_json({
            "msg_all": "this is a mesage for the all connections"
        })

    @classmethod
    async def on_mq_message(cls, message: dict[str, str]):
        for key, value in message.items():
            await cls.ws_manager.broadcast_json({
                "type": key,
                "data": json.loads(value)
            })


@router.websocket_route("/pose_info", name="websocket for pushlish vehicle info")
class PoseWsServer(MulLinkServerEndpoint):
    ws_manager = _manager_pose

    async def on_receive_json(self, mess: dict):
        print(f"I receive mess: {mess}")

        # send message to the connection
        await self.websocket.send_json({
            "msg": "this is a mesage for the one connection"
        })

        # braodcast message to all connections
        await self.broadcast_json({
            "msg_all": "this is a mesage for the all connections"
        })

    @classmethod
    async def publish_pose(cls):
        while True:
            all_v_pose_t = {}
            try:
                all_v_pose = await redis_cli.hgetall("pp4:vehicle:pose")
                for v_id, pose in all_v_pose.items():
                    pose_data = json.loads(pose)
                    all_v_pose_t[v_id] = pose_data
                await cls.ws_manager.broadcast_json({
                    "type": "pose",
                    "data": all_v_pose_t
                })
            except Exception as e:
                logger.error(f"publish_pose error: {repr(e)}")
            await asyncio.sleep(0.3)


@router.websocket_route("/lock_area", name="websocket for lock area")
class AreaWsServer(MulLinkServerEndpoint):
    ws_manager = _manager_lock_area

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
    async def on_mq_message(cls, message: dict[str, str]):
        for key, value in message.items():
            await cls.ws_manager.broadcast_json({
                "type": key,
                "data": json.loads(value)
            })

    @classmethod
    async def publish_lock_area(cls):
        while True:
            all_areas_t = {}
            try:
                all_lock_areas = await redis_cli.hgetall("pp4:lock_area:simweb")
                for v_id, area in all_lock_areas.items():
                    pose_data = json.loads(area)
                    all_areas_t[v_id] = pose_data
                await cls.ws_manager.broadcast_json({
                    "type": "areas",
                    "data": all_areas_t
                })
            except Exception as e:
                logger.error(f"publish_lock_area error: {repr(e)}")
            await asyncio.sleep(2)


@router.websocket_route("/path", name="websocket for pushlish path (short + long)")
class PathWsServer(MulLinkServerEndpoint):
    ws_manager = _manager_path

    async def on_connect(self, websocket: WebSocket) -> None:
        await self.ws_manager.connect(websocket)
        await self.init_pub(websocket)

    @classmethod
    def path_add_extra_info(cls, a_path):
        if a_path["start_pose"] and a_path["path"]:
            path_t = g_roads.trans_path(a_path)
        else:
            a_path["path"] = None
            path_t = a_path
        return path_t

    @classmethod
    async def on_mq_message(cls, mess):
        a_path = json.loads(mess['data'])
        path_t = cls.path_add_extra_info(a_path)

        await cls.ws_manager.broadcast_json({
            "type": path_t["type"],
            "data": {path_t["v"]: path_t}
        })

    async def init_pub(self, websocket: WebSocket):
        _key_short = "pp4:path:short"
        _key_long = "pp4:path:long"

        data_long = await redis_cli.hgetall(_key_long)
        data_short = await redis_cli.hgetall(_key_short)

        for k, v in data_long.items():
            await websocket.send_json({
                "type": "long",
                "data": {
                    k: self.path_add_extra_info(json.loads(v))
                }
            })

        for k, v in data_short.items():
            await websocket.send_json({
                "type": "short",
                "data": {
                    k: self.path_add_extra_info(json.loads(v))
                }
            })
