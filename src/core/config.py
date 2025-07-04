import ujson
from chain_utils.config import Config
from chain_utils.config import sep_to_list

config = Config()

__version__ = "3.2.3.1-2"

TITLE: str = "pp-visual"
VERSION: str = config("pp_visual_VERSION", default=__version__)
DEBUG: bool = config("DEBUG", cast=bool, default=False)
ENABLE_DOCS: bool = config("ENABLE_DOCS", cast=bool, default=True)
ALLOWED_HOSTS: list[str] = config(
    "ALLOWED_HOSTS", cast=sep_to_list(split_char=","), default="*"
)
SWAGGER_UI_PARAMETERS = {}

pp_visual_LOG_NUM: int = config("pp_visual_LOG_NUM", cast=int, default=30)

pp_visual_RUN_HOST: str = config("pp_visual_RUN_HOST", default="0.0.0.0")
pp_visual_RUN_PORT: int = config("pp_visual_RUN_PORT", cast=int, default=8008)
pp_visual_RUN_WORKERS: int = config("pp_visual_RUN_WORKERS", cast=int, default=8)
pp_visual_DB_URL: str = config(
    "pp_visual_DB_URL",
    default="postgresql+asyncpg://postgres:westwell@127.0.0.1:5432/scenario",
)

pp_visual_REDIS_MODE: str = config(
    "pp_visual_REDIS_MODE", default="single"
)
# if redis mode id single, use this config
pp_visual_REDIS_URL: str = config(
    "pp_visual_REDIS_URL", default="redis://127.0.0.1:6379/0"
)
# if redis mode id sentinel, use this config
pp_visual_REDIS_SENTINELS: str = config(
    "pp_visual_REDIS_SENTINELS", default="127.0.0.1:6379,127.0.0.1:6380,127.0.0.1:6381"
)
# for sentinel password
pp_visual_REDIS_SENTINEL_PWD: str = config(
    "pp_visual_REDIS_SENTINEL_PWD", default="westwell"
)

pp_visual_GRPC_PORT: int = config("pp_visual_GRPC_PORT", cast=int, default=10013)

MAP_NAME: str = config("MAP_NAME", cast=str, default="xxxx.osm")
DEMO_REDIS_URL: str = config(
    "DEMO_REDIS_URL", default="redis://127.0.0.1:6379/0"
)

PATH_REPORT_URL = config("PATH_REPORT_URL", cast=str, default="http://127.0.0.1:3000")
