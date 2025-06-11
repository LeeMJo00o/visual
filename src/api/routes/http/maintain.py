from chain_model.model import StdRes
from fastapi import APIRouter
import json
import asyncio
from src.core import config


router = APIRouter()


def desc_ws():
    from src.api.routes.api import router as all_routers
    ws_info = []
    for r in all_routers.routes:
        if hasattr(r.app, "ws_manager"):
            ws_info.append({
                f"{r.path}": {"len": len(r.app.ws_manager.active_connections)}
            })
    return ws_info


def get_obj_info(obj):
    detail = {}
    for name, value in vars(obj).items():
        if name.startswith("__") and name.endswith("__"):
            continue
        try:
            json.dumps(value)
        except Exception as ex:
            value = f"object: {repr(value)}"
        detail[name] = value
    return detail


def get_current_loop():
    loop = asyncio.get_event_loop()
    return str(type(loop))


@router.get("/status", name="service status")
async def get_status() -> StdRes:
    from src.main import app
    routes = []
    for r in app.routes:
        routes.append(f"{r.name} => {r.path}")
    status = {
        "loop": get_current_loop(),
        "ws_clients": desc_ws(),
        "config_info": get_obj_info(config),
        "routes": routes,
    }

    return StdRes(data=status)
