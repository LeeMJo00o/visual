from chain_log.chain_loguru import get_logger, replace_default_handler
from chain_log.logging import use_loguru_catch_std
import logging
import sys

from src.core.config import pp_visual_LOG_NUM

config = {
    "enqueue": True,
    "level": "INFO",
    "rotation": "200 MB",
    "retention": pp_visual_LOG_NUM
}

logger = get_logger("log/main.log", **config)
logger_road = get_logger("log/road.log", **config)

replace_default_handler(sys.stderr, (logger,))

use_loguru_catch_std(logger=logger)
