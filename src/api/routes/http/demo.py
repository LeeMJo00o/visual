from chain_model.model import StdRes
from fastapi import APIRouter, Body
from pydantic import BaseModel
from src.core.log import logger
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.models.demo import DemoTable
from src.db.connect import db_conn_manager
from src.core.config import DEMO_REDIS_URL
import json
import asyncio
import traceback
from src.utils.tools import kv_hash_to_json

router = APIRouter(prefix="")


class NewDbRecord(BaseModel):
    age: int
    name: str


@router.post("/change_weight")
async def change_weight(req: dict = Body()) -> StdRes:
    from chain_redis.aio_connect import get_single
    ext_config = {
        "socket_timeout": 30,
    }
    redis_t = get_single(DEMO_REDIS_URL, ext_config=ext_config)

    sq = await redis_t.hget("attribute_map", "GLOBAL_SEQUENCE")
    if sq:
        sq = json.loads(sq)
        sq["global_sequence:"] = float(req["value"])
    else:
        sq = {
            "global_sequence:": float(req["value"])
        }
    await redis_t.hset("attribute_map", "GLOBAL_SEQUENCE", json.dumps(sq))
    return StdRes()


async def get_traj_demo_from_redis_raw() -> dict:
    from chain_redis.aio_connect import get_single
    ext_config = {
        "socket_timeout": 30,
    }
    try:
        redis_t = get_single(DEMO_REDIS_URL, ext_config=ext_config)
        traj = await redis_t.hgetall("gzn:wellrouting:vehicle:info")
        return kv_hash_to_json(traj)
    finally:
        await redis_t.aclose()


async def get_traj_demo():
    rs_t = {}
    from src.routing import g_routing
    all_long_path = await get_traj_demo_from_redis_raw()
    print(f"long path count: {len(all_long_path)}")
    # all_long_path = dict(list(all_long_path.items())[:200])
    for k, v in all_long_path.items():
        try:
            rs_t[k] = g_routing.trans_path(v)
        except Exception as ex:
            print(f"error for {k}: {v}")
            raise ex

    return rs_t


@router.post("/get_traj")
async def get_traj() -> StdRes:
    import time
    t1 = time.time()
    data = await get_traj_demo()
    t2 = time.time()
    print(f"get traj span :: time: {t2 - t1}")
    return StdRes(data=data)
