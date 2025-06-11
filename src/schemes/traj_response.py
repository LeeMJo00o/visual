#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time : 2025/3/24
# @Author : simon
# @File : traj_response.py 
# @Software: PyCharm
# @Description:
from typing import List

from pydantic import BaseModel


class ShortTrajRespone(BaseModel):
    device_id: str = ""
    task_id: str = ""
    trans_id: str = ""
    map_firmware_id: int = 0
    traj_info: list = []
    trajresponse: dict = {}
    isFinalNavi: bool = False
    timestamp: int = 0


class TrajData(BaseModel):
    traj_id: str = ""
    traj_type: str = ""
    traj_info: list = []

class LongTrajRespone(BaseModel):
    device_id: str = ""
    task_id: str = ""
    trans_id: str = ""
    map_firmware_id: int = 0
    traj_id: str = ""
    traj_type: str = ""
    traj_info: list = []
    lanechange_destination: dict = {}
    isFinalNavi: bool = False
    timestamp: int = 0
    alternate_trajs: List[TrajData] = []  # 长路径才有该值