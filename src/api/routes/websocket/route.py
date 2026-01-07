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
from src.core.config import DEMO_REDIS_URL, pp_visual_DEVICE_MODE
from src.core.log import logger
import traceback
from src.map_tools import g_roads
from src.utils.tools import str_to_json

router = APIRouter()
_manager_pose = ConnectionManager()
_manager_lock_area = ConnectionManager()
_manager_limit_area = ConnectionManager()
_manager_trigger_area = ConnectionManager()
_manager_path = ConnectionManager()


@router.websocket_route("/pose_info", name="websocket for publish vehicle info")
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
                # 使用管道一次性获取所有数据
                pipe = redis_cli.pipeline()
                pipe.hgetall("pp4:vehicle:pose")
                pipe.hgetall("scenario:arbiter:blameAT")
                pipe.hgetall("scenario:arbiter:atBlame")
                pipe.hgetall("scenario:long_path:req_task")
                pipe.get("scenario:priority:real_val")
                pipe.hgetall("pp4:vehicle:device_mode")
                pipe.hgetall("pp4:vehicle:stop_info")
                all_v_pose, all_v_be_blame, all_v_blame, all_v_task,  _all_priority, all_v_mode, all_v_stop_info = await pipe.execute()
                all_priority = json.loads(_all_priority) if _all_priority else {}
                for v_id, pose in all_v_pose.items():
                    pose_data = json.loads(pose)
                    all_v_pose_t[v_id] = pose_data
                    all_v_pose_t[v_id]["blocked_by"] = all_v_be_blame.get(v_id, "")
                    all_v_pose_t[v_id]["block"] = all_v_blame.get(v_id, "")
                    all_v_pose_t[v_id]["task"] = True if all_v_task.get(v_id, None) else False
                    all_v_pose_t[v_id]["device_mode"] = str(all_v_mode.get(v_id, pp_visual_DEVICE_MODE)).lower()
                    all_v_pose_t[v_id]["priority"] = all_priority.get(v_id, -1)
                    # stop info
                    stop_info = json.loads(s) if (s := all_v_stop_info.get(v_id)) else {}
                    all_v_pose_t[v_id]["stop_du"] = stop_info.get("stop_du", 0)  # 停车时长
                    all_v_pose_t[v_id]["stop_du_re"] = stop_info.get("stop_du_re", 0)  # recycle 停车时长

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
    keys = ["pp4:lock_area:simweb", "pp4:lock_area:fms"]  # 读取所有keys的数据
    type = "lock"

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
    async def get_traffic_data(cls):
        if cls.type != "limit":
            return {}
        data_num = {}
        if (data := await redis_cli.hgetall("scenario:traffic_control_area")):
            for v_id, s in data.items():
                try:
                    data_num[v_id] = len(json.loads(s))
                except:
                    pass
        return data_num

    @classmethod
    async def get_areas(cls) -> dict[str, str]:
        if not cls.keys: return {}
        if len(cls.keys) == 1: return await redis_cli.hgetall(cls.keys[0])
        async with redis_cli.pipeline() as pipe:
            for key in cls.keys:
               await pipe.hgetall(key)
            list_of_dicts = await pipe.execute()
        return {k: v for d in list_of_dicts for k, v in d.items()}

    @classmethod
    async def publish_lock_area(cls):
        while True:
            all_areas_t = {}
            try:
                all_lock_areas = await cls.get_areas()
                traffic_num = await cls.get_traffic_data()
                for v_id, area in all_lock_areas.items():
                    area_data = json.loads(area)

                    # 过滤未激活的区域
                    if not(area_data.get("is_active", True)):
                        continue

                    area_data["count"] = traffic_num.get(v_id, 0)
                    all_areas_t[v_id] = area_data
                await cls.ws_manager.broadcast_json({
                    "type": "areas",
                    "data": all_areas_t
                })
            except Exception as e:
                logger.error(f"publish_lock_area error: {repr(e)}, {e} {traceback.format_exc()}")
            await asyncio.sleep(2)

@router.websocket_route("/limit_area", name="websocket for limit area")
class LimitAreaWsServer(AreaWsServer):
    ws_manager = _manager_limit_area
    keys = ["pp4:limit_area:simweb"]
    type = "limit"

@router.websocket_route("/trigger_area", name="websocket for trigger area")
class TriggerAreaWsServer(AreaWsServer):
    ws_manager = _manager_trigger_area
    keys = ["pp4:trigger_area:simweb"]
    type = "trigger"

@router.websocket_route("/path", name="websocket for pushlish path (short + long)")
class PathWsServer(MulLinkServerEndpoint):
    ws_manager = _manager_path

    async def on_connect(self, websocket: WebSocket) -> None:
        await self.ws_manager.connect(websocket)
        await self.init_pub(websocket)

    @classmethod
    async def on_mq_message(cls, mess):
        a_path = json.loads(mess['data'])
        path_t = a_path
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
                    k: json.loads(v)
                }
            })

        for k, v in data_short.items():
            await websocket.send_json({
                "type": "short",
                "data": {
                    k: json.loads(v)
                }
            })

    @classmethod
    async def clear_display(cls):
        await cls.ws_manager.broadcast_json({
            "type": "reload_window",
            "data": None
        })