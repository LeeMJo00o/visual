
from fastapi import FastAPI
from contextlib import asynccontextmanager

from src.api.routes.websocket.polygon import start_polygon_ws
from src.core.log import logger
import traceback
from src.db.connect import db_conn_manager
from chain_orm.tools import create_db_if_not_exists
from src.core.config import pp_visual_DB_URL

from src.services.grpc.start import manager as grpc_manager
from src.services.grpc.start import grpc_tasks
from src.middlewares.mq import mq, mq_route, mq_demo_path
from chain_utils.asyncio_utils import RefTasks
from src.api.routes.websocket.route import PoseWsServer, AreaWsServer, PathWsServer, LimitAreaWsServer, \
    TriggerAreaWsServer
from src.services.map_info import save_map_info

ref_tasks = RefTasks(logger_done=logger)

# trigger when the program starts


async def start():
    try:
        logger.info(f"start ok")
    except Exception as ex:
        logger.warning(f"create db in start error: {type(ex), ex}")

    # mq_route.set_message_callback(RouteWsServer.on_mq_message)
    # ref_tasks << demo_task_convert_path()
    # await mq_route.start_recv()
    # grpc_tasks << grpc_manager.run()

    ref_tasks << PoseWsServer.publish_pose()
    # ref_tasks << DemoPathWsServer.publish_demo_path()
    # ref_tasks << DemoPathWsServerShort.publish_demo_path()
    ref_tasks << AreaWsServer.publish_lock_area()
    ref_tasks << LimitAreaWsServer.publish_lock_area()
    ref_tasks << TriggerAreaWsServer.publish_lock_area()
    mq_demo_path.set_message_callback(PathWsServer.on_mq_message)
    await mq_demo_path.start_recv()
    await start_polygon_ws()
    ref_tasks << save_map_info()

# trigger when the program exits


async def exit():
    if grpc_manager.server:
        await grpc_manager.server.stop(0)
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await start()
    yield
    await exit()
