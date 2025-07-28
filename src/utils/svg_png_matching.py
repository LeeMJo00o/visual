

'''
用于 png 底图和 svg 路径图的匹配（或者说重合）
我们需要确认 png 在画布上的参数，即：

1. 缩放
2. 旋转
3. 平移

这三个参数我们后面使用 s, r, m 来表示

当前的方法是我们先让 svg 以某个适合显示的参数显示在画布上，固定住，然后绘制png, 我们通过缩放、旋转、平移来使 png 恰好与 svg 重合，然后得到此时 png 的 s, r, m 参数，我们得到两组数据：

(s1, r1, m1) 和 (s2, r2, m2)

然后，我们真正显示时，svg 和 png 也有两组参数：

(s3, r3, m3) 和 (s4, r4, m4)

这两个参数能保证我们的png与svg完美重合。那么 (s4, r4, m4) 就是我们最终需要的数据。
这个脚本就是根据前三组数据计算第四组数据的算法实现

以 s1 为例，s1 和 s2 的差异我们记为 s(t), 那么我们只需要将 s(t) 应用于 s3 即可获得 s4 。

s1 -> s(t) = s2
s3 -> s(t) = s4

'''
import math
import numpy as np


class Offset():
    def __init__(self, x, y) -> None:
        self.x = x
        self.y = y

    def __add__(self, other):
        return Offset(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return Offset(self.x - other.x, self.y - other.y)


def cal_v4_1(v1: tuple[float, float, Offset], v2: tuple, v3: tuple):
    s1, r1, m1 = v1
    s2, r2, m2 = v2
    s3, r3, m3 = v3

    s_t = s2 / s1  # 缩放率差值
    s4 = s3 * s_t  # 应用差值

    r_t = r2 - r1
    r4 = r3 + r_t

    m_t = m2 - m1
    m4 = m3 + m_t

    return s4, r4, m4


def create_transform_matrix(s, r, m):
    """创建变换矩阵"""
    cos_r = math.cos(r)
    sin_r = math.sin(r)
    return np.array([
        [s * cos_r, -s * sin_r, m.x],
        [s * sin_r,  s * cos_r, m.y],
        [0, 0, 1]
    ])


def cal_v4_matrix(v1, v2, v3):
    s1, r1, m1 = v1
    s2, r2, m2 = v2
    s3, r3, m3 = v3

    # 创建变换矩阵
    T1 = create_transform_matrix(s1, r1, m1)
    T2 = create_transform_matrix(s2, r2, m2)
    T3 = create_transform_matrix(s3, r3, m3)

    # 计算变换差值 T_diff = T2 * T1^(-1)
    T1_inv = np.linalg.inv(T1)
    T_diff = T2 @ T1_inv

    # 应用差值到T3: T4 = T_diff * T3
    T4 = T_diff @ T3

    # 从T4提取参数
    s4 = math.sqrt(T4[0, 0]**2 + T4[1, 0]**2)
    r4 = math.atan2(T4[1, 0], T4[0, 0])
    m4_x = T4[0, 2]
    m4_y = T4[1, 2]

    return s4, r4, Offset(m4_x, m4_y)


if __name__ == "__main__":
    t = cal_v4_matrix(
        (),
        (),
        (),
    )
    print(t)
