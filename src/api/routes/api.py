from fastapi import APIRouter
from src.api.routes.http.maintain import router as maintain_router
from src.api.routes.http.demo import router as demo_router
from src.api.routes.http.api_proxy import router as proxy_router

from src.api.routes.websocket.route import router as ws_demo_router
from src.api.routes.http.map import router as map_router
from src.api.routes.http.lock_area import router as area_router
from src.api.routes.http.weight_config import router as weight_router
from src.api.routes.http.priority_config import router as priority_router
from src.api.routes.http.speed_fms import router as speed_fms_router
from src.api.routes.http.info import router as info_router

router = APIRouter()

# http
router.include_router(maintain_router, tags=["maintain"], prefix="/maintain")
router.include_router(demo_router, tags=["demo"], prefix="/demo")
router.include_router(map_router, tags=["map"], prefix="/map")
router.include_router(area_router, tags=["area"], prefix="/area")
router.include_router(weight_router, tags=["weight"], prefix="/weight/config")
router.include_router(priority_router, tags=["priority"], prefix="/priority/config")
router.include_router(speed_fms_router, tags=["speed fms"], prefix="/speed/config")
router.include_router(info_router, tags=["infos"], prefix="/infos")

# 转发collector的值
router.include_router(proxy_router)

# websocket
router.include_router(ws_demo_router, tags=["ws-demo"], prefix="/ws/demo")
