
import asyncio
import json
import traceback
from src.middlewares.redis_handler.connect import redis_cli
from chain_utils.asyncio_utils import RefTasks
from src.core.log import logger


class Mq():
    def __init__(self, topic, callback=None) -> None:
        self.topic = topic
        self.redis = redis_cli
        if callback is None:
            self.callback = self.__default_callback
        else:
            self.callback = callback
        self.daemon_task = RefTasks(logger_done=logger)

    async def start_recv(self):
        self.daemon_task << self.__recv()

    async def send(self, key: str, message: dict):
        await self.redis.xadd(self.topic, {key: message}, maxlen=1000)

    def set_message_callback(self, callback):
        self.callback = callback

    async def __recv(self):
        """
        result: [[b'key', [(b'1711434977729-4', {b'data': b'{"987": "987"}'})]]]
        """
        last_id = "$"
        while True:
            try:
                result = await self.redis.xread(streams={self.topic: last_id}, block=1000)
                if result:
                    last_id = result[0][1][-1][0]
                    for _id, value in result[0][1]:
                        await self.callback(value)
            except Exception as e:
                await asyncio.sleep(0.2)
                logger.error(f"__recv_event error: {traceback.format_exc()}")

    async def __default_callback(self, message):
        logger.info(f"recv message __default_callback: {message}")


mq = Mq("pp:route_update")
mq_route = Mq("__cpp_pp:path")
mq_demo_path = Mq("pp4:path:path_mid")
