from fastapi import APIRouter
from src.api.routes.http.maintain import router as maintain_router
from src.api.routes.http.demo import router as demo_router

from src.api.routes.websocket.route import router as ws_demo_router
from src.api.routes.http.map import router as map_router

router = APIRouter()

# http
router.include_router(maintain_router, tags=["maintain"], prefix="/maintain")
router.include_router(demo_router, tags=["demo"], prefix="/demo")
router.include_router(map_router, tags=["map"], prefix="/map")

# websocket
router.include_router(ws_demo_router, tags=["ws-demo"], prefix="/ws/demo")
