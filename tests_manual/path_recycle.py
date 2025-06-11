# -*- coding: utf-8 -*-
# ---------------------------------------
# @Author  : Lu. Yao
# @File    : PyCharm
# @Time    : 2025/4/15 下午3:15
# ---------------------------------------


class RecyclePath:
    def __init__(self):
        self.vid = "AT01"
        self.update_task_url = "http://127.0.0.1:20004/WellGNS/UpdateTask"
        self.get_path_url = "http://127.0.0.1:20004/WellGNS/GetTraj"

    def send_cancel(self):
        pass

    def send_estop(self):
        pass

    def get_path(self):
        pass

    def return_recycle_ok(self):
        pass

    def return_recycle_wait(self):
        pass

    def return_recycle_reject(self):
        pass

    def return_stopped(self):
        pass


