from redis.asyncio import Redis as AioRedis
from chain_redis.aio_connect import get_sentinel_master, get_single
from src.core.config import pp_visual_REDIS_MODE, pp_visual_ARBITER_REDIS_SENTINELS, \
    pp_visual_ARBITER_REDIS_SENTINEL_PWD, pp_visual_ARBITER_REDIS_URL, pp_visual_ARBITER_REDIS_MODE, FMS_REDIS_MODE, \
    FMS_REDIS_SENTINELS, FMS_REDIS_SENTINEL_PWD, FMS_REDIS_URL
from src.core.config import pp_visual_REDIS_URL
from src.core.config import pp_visual_REDIS_SENTINELS
from src.core.config import pp_visual_REDIS_SENTINEL_PWD

if pp_visual_REDIS_MODE == "SENTINEL":
    sentinels = [i.split(":") for i in pp_visual_REDIS_SENTINELS.split(",")]
    _redis_cli = get_sentinel_master(sentinels, pp_visual_REDIS_SENTINEL_PWD)
else:
    _redis_cli = get_single(pp_visual_REDIS_URL)

redis_cli: AioRedis = _redis_cli

# fms redis
_redis_cli_fms = None
if FMS_REDIS_MODE == "SENTINEL":
    sentinels = [i.split(":") for i in FMS_REDIS_SENTINELS.split(",")]
    _redis_cli_fms = get_sentinel_master(sentinels, FMS_REDIS_SENTINEL_PWD,
                                             ext_config={"decode_responses": False})
else:
    if FMS_REDIS_URL:
        _redis_cli_fms = get_single(FMS_REDIS_URL, ext_config={"decode_responses": False})

redis_cli_fms: AioRedis = _redis_cli_fms


if pp_visual_ARBITER_REDIS_MODE == "SENTINEL":
    sentinels = [i.split(":") for i in pp_visual_ARBITER_REDIS_SENTINELS.split(",")]
    _redis_cli_arbiter = get_sentinel_master(sentinels, pp_visual_ARBITER_REDIS_SENTINEL_PWD,
                                             ext_config={"decode_responses": False})
else:
    _redis_cli_arbiter = get_single(pp_visual_ARBITER_REDIS_URL, ext_config={"decode_responses": False})

redis_cli_arbiter: AioRedis = _redis_cli_arbiter
