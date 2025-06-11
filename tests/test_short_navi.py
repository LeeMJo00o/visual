#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time : 2025/4/24
# @Author : simon
# @File : test_short_navi.py 
# @Software: PyCharm
# @Description:
import json
import math

import requests



if __name__ == '__main__':
    data = """
    {
        "device_id":"TD002",
        "trans_id":"ecd02802-528e-496a-8649-070fdb838b87",
        "task_id":"57add0e6-2004-11f0-a382-faf15d788c00",
        "action":0,
        "timestamp":1745386355748,
        "start_pose":{"x":709.5924,"y":1044.7599,"heading":-3.140586,"trailer_x":0.0,"trailer_y":0.0,"trailer_heading":100000.0},
        "end_pose":{"x":709.5906966615051,"y":1044.6446106338133,"heading":-3.140586,"bidirection":0},
        "block_id":"",
        "stack_id":"",
        "navi_poses":[],
        "navi_traj":[],
        "device_type":3,"traj_type":"points",
        "task_type":"shortnavi",
        "passing_location":[],
        "arrive":false,
        "reverse":false,
        "via":0,
        "version":3
    }
    """

    url = "http://127.0.0.1:8008/RoutingInterface/navigation/update"
    res = requests.post(url, data=data)

    print(res.status_code)
    print(res.text)

    data = json.loads(res.text)
    command_reference_lines = data.get("body", {}).get("command_reference_lines", [])

    if command_reference_lines:
        points = command_reference_lines[0].get("points", [])
        for i in range(len(points) - 1):
            p1 = points[i]
            p2 = points[i+1]
            theta = math.atan2(p2["y"] - p1["y"], p2["x"] - p1["x"])
            print(f"{i}: {theta}")

