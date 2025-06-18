import asyncio
import random
import math
from fastapi import APIRouter
from chain_websocket.server import ConnectionManager, MulLinkServerEndpoint
from src.middlewares.mq import mq_route
import json
from src.middlewares.redis_handler.connect import redis_cli
from src.core.config import DEMO_REDIS_URL

router = APIRouter()
_manager = ConnectionManager()
_manager_demo_path = ConnectionManager()
_manager_demo_short_path = ConnectionManager()
_manager_pose = ConnectionManager()


def str_to_json(s: dict) -> dict:
    rs = {}
    for key, value in s.items():
        value_t = json.loads(value)
        if key:
            rs[key] = value_t
    return rs


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
                    "data":  all_v_pose_t
                })
            except Exception as e:
                print(f"publish_pose error: {e}")
            await asyncio.sleep(0.3)


class BasePathWs(MulLinkServerEndpoint):
    ws_manager = None
    path_kv_key = None

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
    async def get_traj_demo_from_redis_raw(cls) -> dict:
        from chain_redis.aio_connect import get_single
        ext_config = {
            "socket_timeout": 30,
        }
        try:
            redis_t = get_single(DEMO_REDIS_URL, ext_config=ext_config)
            traj = await redis_t.hgetall(cls.path_kv_key)
            return str_to_json(traj)
        finally:
            await redis_t.aclose()

    @classmethod
    async def get_traj_demo(cls):
        rs_t = {}
        from src.routing import g_routing
        all_long_path = await cls.get_traj_demo_from_redis_raw()
        print(f"path count: {len(all_long_path)}")
        # all_long_path = dict(list(all_long_path.items())[:200])
        for k, v in all_long_path.items():
            try:
                rs_t[k] = g_routing.trans_path(v)
            except Exception as ex:
                print(f"error for {k}: {v}")
                raise ex

        return rs_t

    @classmethod
    async def publish_demo_path(cls):
        # cycle_time = (all_number / batch_number) * sleep_time
        cycle_time, sleep_time = 1, 0.1
        just_use = 100000
        while True:
            try:
                all_v_pose_t = await cls.get_traj_demo()
                all_v_pose_t = dict(list(all_v_pose_t.items())[:just_use])
                all_number = len(all_v_pose_t)
                if all_number <= 0:
                    await asyncio.sleep(0.5)
                    continue
                batch_number = math.ceil(all_number / (cycle_time / sleep_time))
                print(f"all path number: {batch_number} / {all_number}")
                vehicle_ids = list(all_v_pose_t.keys())
                # random.shuffle(vehicle_ids)  # 打乱车辆顺序
                for i in range(0, len(vehicle_ids), batch_number):
                    batch_vehicles = vehicle_ids[i:i+batch_number]
                    batch_data = {vid: all_v_pose_t[vid] for vid in batch_vehicles}
                    await cls.ws_manager.broadcast_json({
                        "type": "long_path",
                        "data": batch_data
                    })
                    await asyncio.sleep(sleep_time)
            except Exception as e:
                print(f"publish path error: {e}")
            await asyncio.sleep(0.1)


@router.websocket_route("/demo_path", name="websocket for pushlish demo path")
class DemoPathWsServer(BasePathWs):
    path_kv_key = "pp4:path:long"
    ws_manager = _manager_demo_path


@router.websocket_route("/demo_short_path", name="websocket for pushlish demo path (short)")
class DemoPathWsServerShort(BasePathWs):
    path_kv_key = "pp4:path:short"
    ws_manager = _manager_demo_short_path
