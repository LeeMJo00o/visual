import asyncio
from src.plugins.alternative_routes.get_alt_path import AltPathGetter
from src.utils.tools import gen_josm_query_string
from src.plugin.service import Service


async def run():
    plugin = AltPathGetter(Service())
    s = [228.02, 516.5622]
    e = [727.5906, 143.7245]

    start = {
        "x": -388.957245,
        "y": 55.156975,
    }

    end = {
        "x": -266.28,
        "y": -36.79,
    }

    s = [start["x"], start["y"]]
    e = [end["x"], end["y"]]

    path = await plugin.get_raw_path(s, e)
    print(gen_josm_query_string(path["shortest_path"]))


if __name__ == "__main__":
    asyncio.run(run())
