import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.api.routes.api import router as api_router
from starlette.middleware.cors import CORSMiddleware
from chain_utils.swagger import use_static_swagger
from chain_utils.ws_debug import use_ws_debug_page
from src.core.config import ENABLE_DOCS, TITLE, VERSION, SWAGGER_UI_PARAMETERS, ALLOWED_HOSTS, DEBUG
from src.core.config import pp_visual_RUN_HOST, pp_visual_RUN_PORT, pp_visual_RUN_WORKERS
from src.core.lifespan import lifespan
from fastapi.middleware.gzip import GZipMiddleware
from src.core.log import logger
import os


def get_application() -> FastAPI:
    application = FastAPI(
        title=TITLE,
        debug=DEBUG,
        version=VERSION,
        lifespan=lifespan,
        docs_url="/docs" if ENABLE_DOCS else None,
        openapi_url="/openapi.json" if ENABLE_DOCS else None,
        redoc_url="/redoc" if ENABLE_DOCS else None,
        swagger_ui_parameters=SWAGGER_UI_PARAMETERS,
        description="scenario",
    )
    use_static_swagger(application)
    use_ws_debug_page(application)

    # 配置 CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_HOSTS or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 配置 Gzip 压缩
    application.add_middleware(GZipMiddleware, minimum_size=100 * 1000, compresslevel=5)

    # /api 在静态文件之前添加
    application.include_router(api_router, prefix="/api")

    # 挂载静态文件目录
    # 注意,这是给生产环境用的, 本地 debug 请单独运行前端, 不要混淆了
    # 不要在项目根目录创建 frontend_dist
    frontend_dist_path = "frontend_dist"
    if os.path.exists(frontend_dist_path):
        application.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")
    else:
        logger.info(f"frontend dist: {frontend_dist_path} no exists, may you env is dev")
    
    return application


app = get_application()

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        loop="uvloop",
        host=pp_visual_RUN_HOST,
        port=pp_visual_RUN_PORT,
        workers=pp_visual_RUN_WORKERS
    )
