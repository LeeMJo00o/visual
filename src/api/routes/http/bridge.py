import json

from fastapi import APIRouter, Body
from chain_http import aio_http
from chain_model.model import StdRes

from src.core.config import pp_visual_BRIDGE_URL
from src.core.log import logger

router = APIRouter()


@router.post("/message")
async def bridge_message(req: dict = Body()) -> StdRes:
    bridge_url = f"{pp_visual_BRIDGE_URL.rstrip('/')}/api/bridge/message"
    logger.info(f"bridge message forwarding: url={bridge_url}, payload={req}")
    res = await aio_http.post(bridge_url, json=req, timeout=10)
    try:
        json_attr = getattr(res, "json", None)
        if callable(json_attr):
            data = await json_attr()
        else:
            data = json_attr
    except Exception:
        text_attr = getattr(res, "text", None)
        if callable(text_attr):
            raw = await text_attr()
        else:
            raw = text_attr
        data = {"raw": raw}
    logger.info(f"bridge message response: status={res.status}, payload={data}")
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            data = {"raw": data}
    return StdRes(data={"ok": res.status == 200, "result": data})
