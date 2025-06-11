
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.core.config import pp_visual_RUN_PORT
from src.api.routes.http.api_proxy import get_headers

class TestApiProxy():
    def test_get_headers(self):
        raw = {
            'user-agent': "ww/tao.xie",
            "accept": "application/json",
            "content-type": "c1/c2",
            "host": "127.0.0.1:8008",
        }
        use_filter = set(["accept", "content-type"])
        raw_t = {
            "accept": "application/json",
            "content-type": "c1/c2",
        }
        assert get_headers(raw, use_filter) == raw_t
