
from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.core.log import logger
import traceback
from src.db.connect import db_conn_manager
from chain_orm.tools import create_db_if_not_exists
from src.core.config import pp_visual_DB_URL

from src.services.grpc.start import manager as grpc_manager
from src.services.grpc.start import grpc_tasks
from src.middlewares.mq import mq, mq_route
from src.api.routes.websocket.route import RouteWsServer, PoseWsServer, DemoPathWsServer, DemoPathWsServerShort
from chain_utils.asyncio_utils import RefTasks

ref_tasks = RefTasks(logger_done=logger)

# trigger when the program starts
async def start():
    try:
        logger.info(f"start ok")
    except Exception as ex:
        logger.warning(f"create db in start error: {type(ex), ex}")

    mq_route.set_message_callback(RouteWsServer.on_mq_message)
    ref_tasks << PoseWsServer.publish_pose()
    # ref_tasks << demo_task_convert_path()
    # await mq_route.start_recv()
    # grpc_tasks << grpc_manager.run()

    ref_tasks << DemoPathWsServer.publish_demo_path()
    ref_tasks << DemoPathWsServerShort.publish_demo_path()
    pass

# trigger when the program exits


async def exit():
    await grpc_manager.server.stop(0)
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await start()
    yield
    await exit()
