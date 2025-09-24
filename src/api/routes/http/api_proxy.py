import json
import traceback
from fastapi import APIRouter, Request, Response
from chain_http import aio_http
from src.core.log import logger_proxy as logger
from src.core.config import pp_visual_COLLECTOR_URL


router = APIRouter()


def get_headers(src_headers: dict[str, str], fields: set[str]) -> dict[str, str]:
    return {
        key: value for key, value in src_headers.items() 
        if key.lower() in fields
    }


def proxy_api_func(to_path_template, req_middleware=None):
    """ 返回 fastapi route function， 该 route 将请求代理到 `to_path` 中"""

    async def api_proxy(
            request: Request,
            path: str = ""  # 添加路径参数
    ):
        body = await request.body()
        copy_headers = set([
            "accept",
            "content-type",
        ])
        headers = get_headers(dict(request.headers), copy_headers)
        query_params = dict(request.query_params)

        # 构建目标URL
        to_path = to_path_template.format(path=path)

        logger.info(f"[proxy_api] req: {body}")
        body_t = await req_middleware(body) if req_middleware else body
        logger.info(f"[proxy_api] req target: {body_t}")
        res = await aio_http.request(request.method, to_path, params=query_params, data=body_t,
                                     headers=dict(headers))
        logger.info(f"[proxy_api] path: {request.url.path} <==> {to_path}")
        logger.info(f"[proxy_api] resp: {res.text}")
        res_headers = {
            "content-type": res.content_type
        }
        return Response(content=res.text, headers=res_headers, status_code=res.status)
    return api_proxy



def apply_apis_proxy():
    # 添加/api/replay/和/api/record/路径的通配代理
    proxy_config= [
        ("/replay/{path:path}", f"{pp_visual_COLLECTOR_URL}/api/replay/{{path}}", None),
        ("/record/{path:path}", f"{pp_visual_COLLECTOR_URL}/api/record/{{path}}", None),
    ]

    for path, to_path, mid in proxy_config:
        router.add_api_route(
            path,
            proxy_api_func(to_path, mid),
            methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],  # 支持所有常用HTTP方法
            operation_id=path
        )


apply_apis_proxy()
