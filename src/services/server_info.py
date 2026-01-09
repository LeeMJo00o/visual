import asyncio
import os
import aiodocker
from datetime import datetime
from typing import Dict, Iterable
from aiohttp import ClientTimeout

async def get_docker() -> list[dict]:
    docker = aiodocker.Docker("unix:///var/run/docker.sock", timeout=ClientTimeout(5, 5, 5, 5))
    try:
        cons = []
        for container in (await docker.containers.list(all=False)):
            info = await container.show()
            config = info["Config"]
            state = info["State"]
            started_at = datetime.fromisoformat(state["StartedAt"].replace('Z', '+00:00'))
            con = {
                "name": info["Name"][1:],
                "image": config["Image"],
                "start_at": started_at.strftime("%Y-%m-%d %H:%M")
            }
            cons.append(con)
    finally:
        await docker.close()
    return cons

def get_env(denoise: bool = True) -> Dict[str, str]:
    noisy_keys = {
    # 常见 shell/系统噪音环境变量名单（按需可继续加）
        "LS_COLORS",
        "LSCOLORS",
        "OLDPWD",
        "SHLVL",
        "TERM",
        "TERM_PROGRAM",
        "TERM_PROGRAM_VERSION",
        "COLORTERM",
        "LESS",
        "LESSOPEN",
        "LS_OPTIONS",
        "SHELL",
        "USER",
        "LOGNAME",
        "HOME",
        "PATH",
        "XDG_SESSION_TYPE",
        "XDG_RUNTIME_DIR",
        "XDG_DATA_DIRS",
        "XDG_CONFIG_DIRS",
        "ZSH",
        "HISTFILE",
        "HISTSIZE",
        "SAVEHIST",
        "_",
    }

    envs: Dict[str, str] = {}
    for k, v in os.environ.items():
        if denoise and k in noisy_keys:
            continue
        envs[k] = v

    return envs

