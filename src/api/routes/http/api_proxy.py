import json
import traceback
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from chain_http import aio_http
import aiohttp
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


def streaming_proxy_api_func(to_path_template, has_path_param=False):
    """
    返回 fastapi route function，支持流式代理，适用于文件上传/下载
    使用 aiohttp 实现流式传输，避免大文件占用内存
    
    Args:
        to_path_template: 目标URL模板
        has_path_param: 是否有路径参数
    """

    async def api_proxy(request: Request, path: str = ""):
        # 需要复制的请求头
        copy_headers = set([
            "accept",
            "content-type",
            "content-length",
            "content-disposition",
        ])
        headers = get_headers(dict(request.headers), copy_headers)
        query_params = dict(request.query_params)

        # 构建目标URL
        to_path = to_path_template.format(path=path) if has_path_param else to_path_template
        
        content_length = request.headers.get("content-length", "0")
        logger.info(f"[streaming_proxy] {request.method} {request.url.path} => {to_path}, content-length={content_length}")

        async def stream_request_body():
            """流式读取请求体"""
            async for chunk in request.stream():
                yield chunk

        async def stream_response_generator():
            """流式代理生成器，管理整个请求-响应生命周期"""
            timeout = aiohttp.ClientTimeout(total=300, connect=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.request(
                    method=request.method,
                    url=to_path,
                    params=query_params,
                    headers=headers,
                    data=stream_request_body(),
                ) as res:
                    # 先 yield 状态信息（用于构建响应头）
                    yield {
                        "status": res.status,
                        "headers": {
                            key: res.headers[key]
                            for key in ["content-type", "content-disposition", "content-length"]
                            if key in res.headers
                        }
                    }
                    # 然后 yield 响应内容
                    async for chunk in res.content.iter_any():
                        yield chunk

        # 创建生成器
        generator = stream_response_generator()
        
        # 获取第一个 yield（状态信息）
        meta = await generator.__anext__()
        
        logger.info(f"[streaming_proxy] response status={meta['status']}, headers={meta['headers']}")

        async def body_generator():
            """只 yield 响应体内容"""
            async for chunk in generator:
                yield chunk

        return StreamingResponse(
            content=body_generator(),
            status_code=meta["status"],
            headers=meta["headers"],
        )

    # 对于精确路径，返回无path参数的函数
    if not has_path_param:
        async def api_proxy_no_path(request: Request):
            return await api_proxy(request, "")
        return api_proxy_no_path
    
    return api_proxy



def apply_apis_proxy():
    # 流式代理配置: 适用于文件上传/下载等大数据传输场景
    # 注意：精确路径必须先注册，且不能有 {path:path} 参数
    streaming_proxy_config = [
        ("/replay/upload/db/file", f"{pp_visual_COLLECTOR_URL}/api/replay/upload/db/file", False),
        ("/replay/download/db/file", f"{pp_visual_COLLECTOR_URL}/api/replay/download/db/file", False),
    ]
    
    for path, to_path, has_path_param in streaming_proxy_config:
        router.add_api_route(
            path,
            streaming_proxy_api_func(to_path, has_path_param),
            methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            operation_id=f"streaming_{path}"
        )

    # 普通代理配置: (路径, 目标URL, 中间件)
    # 添加/api/replay/和/api/record/路径的通配代理
    proxy_config = [
        ("/replay/{path:path}", f"{pp_visual_COLLECTOR_URL}/api/replay/{{path}}", None),
        ("/record/{path:path}", f"{pp_visual_COLLECTOR_URL}/api/record/{{path}}", None),
    ]

    for path, to_path, mid in proxy_config:
        router.add_api_route(
            path,
            proxy_api_func(to_path, mid),
            methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            operation_id=path
        )

apply_apis_proxy()
