#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time: 2025/9/24
# @Author: simon
# @File: MapInfo.py 
# @Software: PyCharm
# @Description:
import uuid
from typing import Any

from pydantic import BaseModel, Field, field_validator
from src.core.config import MAP_NAME


class MapInfo(BaseModel):
    # wellmap相关
    mapName: str = Field(default=MAP_NAME, description="地图文件名")

    @field_validator("mapName",
                     mode="before")
    @classmethod
    def default_mapname(cls, v):
        if not v:
            return MAP_NAME
        return v
