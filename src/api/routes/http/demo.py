from chain_model.model import StdRes
from fastapi import APIRouter, Body
from pydantic import BaseModel
from src.core.log import logger
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.models.demo import DemoTable
from src.db.connect import db_conn_manager
from src.core.config import DEMO_REDIS_URL, PATH_REPORT_URL
import json
import asyncio
import traceback
from src.utils.tools import kv_hash_to_json
from chain_http import aio_http

router = APIRouter(prefix="")


class NewDbRecord(BaseModel):
    age: int
    name: str


@router.post("/change_weight")
async def change_weight(req: dict = Body()) -> StdRes:
    url = f"{PATH_REPORT_URL}/api/chain/execute-chain"
    req = {
        "id": "wf_update_routing_weight",
        "req_data": {
            "weight": float(req["value"])
        }
    }
    res = await aio_http.post(url, json=req, timeout=5)
    logger.info(f"weight change: {req} => {res.status, res.text}")
    return StdRes()
