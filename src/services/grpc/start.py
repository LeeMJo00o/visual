import asyncio
from chain_utils.asyncio_utils import RefTasks
from chain_grpc.async_server import GrpcServerManager
from .protos.hello_pb2_grpc import add_BridgeServiceServicer_to_server
from .hello_service import HelloServicer
from src.core.log import logger
from src.core.config import pp_visual_GRPC_PORT


manager = GrpcServerManager(
    pp_visual_GRPC_PORT,
    servicer=HelloServicer,
    add_to_server_func=add_BridgeServiceServicer_to_server,
)

grpc_tasks = RefTasks(logger_done=logger)
