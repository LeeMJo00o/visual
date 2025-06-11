
from redis.asyncio import Redis as AioRedis
from chain_redis.aio_connect import get_sentinel_master, get_single
from src.core.config import pp_visual_REDIS_MODE
from src.core.config import pp_visual_REDIS_URL
from src.core.config import pp_visual_REDIS_SENTINELS
from src.core.config import pp_visual_REDIS_SENTINEL_PWD


if pp_visual_REDIS_MODE == "SENTINEL":
    sentinels = [i.split(":") for i in pp_visual_REDIS_SENTINELS.split(",")]
    _redis_cli = get_sentinel_master(sentinels, pp_visual_REDIS_SENTINEL_PWD)
else:
    _redis_cli = get_single(pp_visual_REDIS_URL)

redis_cli: AioRedis = _redis_cli
