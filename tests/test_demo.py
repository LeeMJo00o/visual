
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.core.config import pp_visual_RUN_PORT


class TestDemo():
    async def test_hello(self):
        arg1 = 110
        arg2 = "req-2"
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=f"http://127.0.0.1:{pp_visual_RUN_PORT}/api/demo/"
        ) as ac:
            response = await ac.get("/hello", params={"arg1": arg1, "arg2": arg2})
        assert response.status_code == 200
        assert response.json()["msg"] == f"your request: {arg1}: {arg2}"
