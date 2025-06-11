#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time : 2025/4/24
# @Author : simon
# @File : test_numpy_project_point.py 
# @Software: PyCharm
# @Description:
import numpy as np

def projection_point(A, B, P, Distance: float = 0):
    A = np.array(A)
    B = np.array(B)
    P = np.array(P)
    AB = B - A
    AP = P - A
    t = np.dot(AP, AB) / np.dot(AB, AB)
    Q = A + t * AB

    length_AB = np.linalg.norm(AB)
    unit_vector = AB / length_AB  # 从A到B的单位向量
    q = Q - unit_vector * Distance  # 向A方向移动
    return q


if __name__ == '__main__':
    A = [0, 0]
    B = [1, 1]
    P = [3, 4]
    Q = projection_point(A, B, P)

    print(Q)  # 输出: [3.5 3.5]

    A = [0, 0]
    B = [100, 0]
    P = [3.5, 1]
    Q = projection_point(A, B, P, -1)
    print(Q)  # 输出: [3.5 3.5]
