import os
import re
from .routing import Routing
import lanelet2
import json
import math
from typing import List, Tuple
import numpy as np
from typing import List, Dict, Tuple
from attr import attrs, attrib, asdict
from copy import deepcopy
import time
import traceback

PATH = False


def getMapInfo(file_path: str) -> dict:
    _result = {"version": '', "lat": '', "lon": ''}
    if not os.path.exists(file_path):
        return _result
    with open(file_path, 'r') as f:
        for line in f:
            if "user" not in line:
                continue
            for key in _result.keys():
                match = re.search(f"{key}='(.*?)'", line)
                if match:
                    _result[key] = float(match.group(1))

                match = re.search(f'{key}="(.*?)"', line)
                if match:
                    _result[key] = float(match.group(1))
            break
    return _result


def osm_to_json(routing: Routing):
    osm_attrs = ["is_straight",
                 "road_type",
                 "pptype",
                 "lock_station",
                 "bridge_path",
                 "check_block",
                 "Priority_Value"
                 "block_id",
                 "cut_in_block_ids",
                 "lane_change",
                 ]

    lanes = []
    try:
        for idx, llt in enumerate(routing.map.laneletLayer):
            llt: lanelet2.core.Lanelet = llt
            if "drivable" not in llt.attributes or ("drivable" in llt.attributes and llt.attributes["drivable"].lower() != "true"):
                continue
            is_straight = True if "is_straight" in llt.attributes.keys() and llt.attributes[
                "is_straight"].lower() == 'true' else False

            _points = []

            for p in llt.centerline:
                _p = {"x": round(p.x, 3), "y": round(p.y, 3)}
                _points.append(_p)

            turn = "NO_TURN" if is_straight else "LEFT_TURN"
            length = 0
            width = float(
                llt.attributes["lane_width"] if "lane_width" in llt.attributes.keys() else 3.2)

            try:
                length = lanelet2.geometry.length(llt.centerline)
            except Exception as e:
                raise e
            if routing.routing_graph:
                llt_pre = routing.routing_graph.previous(llt)
                llt_follow = routing.routing_graph.following(llt)
            else:
                llt_pre = []
                llt_follow = []
            lane = {
                "id": {"id": f"{llt.id}"},
                "osm_id": f"{llt.id}",
                "centralCurve": {"segment": [{"lineSegment": {"point": _points}}]},
                "length": round(length, 3),
                "width": round(width, 3),
                "turn": turn,
                "predecessorId": [{"id": f"{i.id}"} for i in llt_pre],
                "successorId": [{"id": f"{i.id}"} for i in llt_follow]
            }
            for _attr in osm_attrs:
                if _attr in llt.attributes:
                    lane[f"osm_{_attr}"] = llt.attributes[_attr]
            lanes.append(lane)

        for lane in lanes:
            lane['predecessorId'] = []
            lane['successorId'] = []

        _hdmap = {
            "lane": lanes
        }
        return _hdmap
    except Exception as ex:
        raise ex


def save_to_json(data, file_path: str):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        print(f"数据已保存到: {file_path}")

    except Exception as e:
        print(f"保存 JSON 文件失败: {e}")


def load_from_json(file_path: str):
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def heading(p1, p2):
    """计算两个点的夹角"""
    ret = 0.0

    if len(p1) == 2 and len(p2) == 2:
        a = (p2[0] - p1[0], p2[1] - p1[1])
        b = (1, 0)

        n1 = np.array(a)
        n2 = np.array(b)

        l1 = np.sqrt(n1.dot(n1))
        l2 = np.sqrt(n2.dot(n2))

        cosAngle = n1.dot(n2) / (l1 * l2)
        angle = np.arccos(cosAngle)

        aXb = np.cross(n1, n2)

        ret = (1 if aXb < 0 else -1) * angle

    else:
        raise Exception("Parameter is not Point ...")

    return ret


def angle_rad(theta1: float, theta2: float) -> float:
    """
    求两个角度的夹角 - 单位弧度
    输入的单位为弧度值
    """
    dx1 = math.cos(theta1)
    dy1 = math.sin(theta1)
    dx2 = math.cos(theta2)
    dy2 = math.sin(theta2)
    angle1 = math.atan2(dy1, dx1)
    # print(angle1)
    angle2 = math.atan2(dy2, dx2)
    # print(angle2)
    if angle1 * angle2 >= 0:
        included_angle = abs(angle1 - angle2)
    else:
        included_angle = abs(angle1) + abs(angle2)
        if included_angle > math.pi:
            included_angle = 2*math.pi - included_angle
    return included_angle


@attrs
class Point(object):
    x = attrib(type=float)
    y = attrib(type=float)
    h = attrib(type=float, default=None)


def calculateCurvature(points: List[Point]) -> Tuple[List[float], List[float]]:
    _list1 = []
    _list2 = []
    if points and len(points) >= 2:
        _len = len(points)
        for i in range(_len - 1):
            p1 = points[i]
            p2 = points[i+1]
            ds = math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)
            dtheta = abs(angle_rad(p2.h, p1.h))
            if ds == 0:
                continue
            else:
                _list1.append(dtheta/ds)
        _len1 = len(_list1)
        if _len1 >= 2:
            for j in range(_len1 - 1):
                _list2.append(abs(_list1[j+1] - _list1[j]))

    return _list1, _list2


class LanePoints(object):
    def __init__(self, points: list, pointsStr: str, pointsStr2: str, length: float, direction: str = "", turn: str = "",
                 nextlaneIds: str = "",
                 data: dict = None):
        self.points = points
        self.pointsStr = pointsStr
        self.pointsStr2 = pointsStr2
        self.length = round(float(length), 3)
        self.direction = direction
        self.turn = turn
        self.nextlaneIds = nextlaneIds
        self.data = data if data else {}
        self.z1 = round(points[0].get('z'), 3) if points[0].get('z') else points[0].get('z')
        self.z2 = round(points[-1].get('z'), 3) if points[-1].get('z') else points[-1].get('z')

        self.start_end = f"[({points[0]['x']}, {points[0]['y']}, {self.z1}), ({points[-1]['x']}, {points[-1]['y']}, {self.z2})]"


@attrs
class PointsCurvatureInfo(object):
    points = attrib(type=List[Point])
    curvatureList = attrib(type=List[float], default=[])
    dCurvatureList = attrib(type=List[float], default=[])

    def __attrs_post_init__(self):
        self.curvatureList, self.dCurvatureList = calculateCurvature(self.points)


def _checkTurnLane(lanePoints, requireValue: float = 13.0):
    """
    检查入弯和出弯的x和y是否大于等于指定值
    :param lanePoints:
    :return:
    """
    _inPoint = lanePoints[0]
    _outPoint = lanePoints[-1]
    return not (abs(_inPoint['x'] - _outPoint['x']) >= requireValue and abs(_inPoint['y'] - _outPoint['y']) >= requireValue)


def _checkLaneChange(lanePoints, width: float = 7.0, requireLength: float = 21.0):
    """

    :param lanePoints:
    :param width:
    :param requireLength:
    :return:
    """
    _inPoint = lanePoints[0]
    _outPoint = lanePoints[-1]
    _dx = abs(_inPoint['x'] - _outPoint['x'])
    _dy = abs(_inPoint['y'] - _outPoint['y'])
    _w = min(_dx, _dy)
    _l = max(_dx, _dy)
    if _w <= width:
        return not (_l >= requireLength)
    return False


@attrs
class CurvatureInfo(object):
    laneId = attrib(type=str)
    lanePoints = attrib(type=list)
    laneDirection = attrib(type=str)
    forward = attrib(type=PointsCurvatureInfo, default=None)
    backward = attrib(type=PointsCurvatureInfo, default=None)

    def __attrs_post_init__(self):
        _points: List[Point] = self._getPoints()

        self.forward: PointsCurvatureInfo = None
        self.backward: PointsCurvatureInfo = None
        if self.laneDirection == 'FORWARD':
            self.forward = PointsCurvatureInfo(_points)
        elif self.laneDirection == 'BACKWARD':
            _points.reverse()
            self.backward = PointsCurvatureInfo(_points)
        else:
            self.forward = PointsCurvatureInfo(_points)
            _points2 = deepcopy(_points)
            _points2.reverse()
            self.backward = PointsCurvatureInfo(_points2)

    def _getPoints(self) -> List[Point]:
        _list = []
        if self.lanePoints and len(self.lanePoints) >= 2:
            for p in self.lanePoints:
                _x = p.get('x')
                _y = p.get('y')
                _h = p.get('z', None)
                _list.append(Point(_x, _y, _h))
            if _h is None:
                _len = len(_list)
                for i in range(_len):
                    p = _list[i]
                    p1, p2 = (_list[i - 1], _list[i]) if i == _len - 1 else (_list[i], _list[i + 1])
                    p.h = heading([p1.x, p1.y], [p2.x, p2.y])
        return _list

    def asDict(self):
        return asdict(self)

    @staticmethod
    def asDictList(_list: List['CurvatureInfo']) -> List[dict]:
        _list2 = []
        if _list:
            for item in _list:
                _list2.append(item.asDict())
        return _list2


def _checkCurvature(curvatureInfo: CurvatureInfo, requireCurvatureValue: float, requireDCurvatureValue: float) -> bool:
    if curvatureInfo.forward:
        for v in curvatureInfo.forward.curvatureList:
            if abs(v) >= requireCurvatureValue:
                return True
        for v in curvatureInfo.forward.dCurvatureList:
            if abs(v) >= requireDCurvatureValue:
                return True
    if curvatureInfo.backward:
        for v in curvatureInfo.backward.curvatureList:
            if abs(v) >= requireCurvatureValue:
                return True
        for v in curvatureInfo.backward.dCurvatureList:
            if abs(v) >= requireDCurvatureValue:
                return True
    return False


def _angle(angle1, angle2):
    """
    # 计算两条边/向量的夹角
    # :param v1: [x1, y1, x2, y2]
    # :param v2: [x3, y3, x4, y4]
    :return: 夹角 0-180
    """
    # angle1 = normalize_angle(angle1)
    # angle2 = normalize_angle(angle2)
    try:
        # dx1 = v1[2] - v1[0]
        # dy1 = v1[3] - v1[1]
        # dx2 = v2[2] - v2[0]
        # dy2 = v2[3] - v2[1]
        # angle1 = math.atan2(dy1, dx1)
        angle1 = int(angle1 * 180 / math.pi)
        # print(angle1)
        # angle2 = math.atan2(dy2, dx2)
        angle2 = int(angle2 * 180 / math.pi)
        # print(angle2)
        if angle1 * angle2 >= 0:
            included_angle = abs(angle1 - angle2)
        else:
            included_angle = abs(angle1) + abs(angle2)
            if included_angle > 180:
                included_angle = 360 - included_angle
        return included_angle
    except Exception as e:
        print(f"test angle1: {angle1}, angle2: {angle2}")
        raise e


def parseMapNew(file_path, minGap: float, maxGap: float, maxGap2: float, type1: int = None, type2: int = None, inverseXAxis=False,
                inverseYAxis=True, requireValue: float = 13.0,
                checkCurvature: bool = True, requireCurvatureValue: float = 0.08, requireDCurvatureValue: float = 0.01,
                exportLevel: str = 'ALL',
                simplifyCurveLane: bool = False,
                optimizeLine: bool = False,
                checkEnableDict: dict = {},
                blockIds: List[str] = ["all"],
                heightIds: List[str] = []):
    __lines_points_line = {}  # {"laneid":[{x,y}, {x, y}],[...]}
    __lines_points_curve = {}  #

    _lines_points_both = {}  # {"laneid":[{x,y}, {x, y}],[...]}
    _lines_points_pre = {}
    _lines_points_succ = {}

    _lines_points_left = {}
    _lines_points_right = {}
    _lines_points_noturn = {}
    _lines_points_lanechange = {}
    _lines_points_noneTurn = {}

    # 标记为直线但实际上不是直线
    _lines_points_noturn_error = {}

    # error
    _lines_points_error_lanechange = {}
    _lines_points_error_turn = {}
    _lines_error_curvature = {}
    _errorCurvatureInfoList = []

    # 蟹形
    _lines_points_lanechange_isCrab = {}

    # 带z - heading的lane
    _lines_points_with_heading = {}

    _lines_points_type = {}

    _lines_points_type2 = {}

    _lines_points_forward = {}
    _lines_points_backward = {}
    _lines_points_bidirection = {}
    _lines_points_noneDirection = {}

    # 带有blockId的lane
    _lines_points_blockId = {}

    __lines_points_gap = {}  # {"laneid":[{x,y}, {x, y}],[...]}
    __lines_points_gap_error = {}

    __lanePointsAndNextLane = {}  # {"laneid": {points: [{x,y}, {x, y}],[...], nextlaneIds: ["1"]}

    __map_dict = {}
    # t1 = time.time()
    # with open(file_path, 'r') as f:
    #     __map_dict = ujson.load(f)
    # t2 = time.time()
    # print(f"read map span time {round((t2 - t1) * 1000, 3)} ms.")

    __map_dict = load_from_json(file_path)

    __lane_list = __map_dict["lane"]

    _all_no_turn_ids = []
    for lane in __lane_list:
        _laneId = lane["id"]["id"]
        _lane_turn = lane.get('turn')
        if _lane_turn == "NO_TURN":
            _all_no_turn_ids.append(_laneId)

    def _hasNoTurn(_ids):
        if _ids:
            for item in _ids:
                if item["id"] in _all_no_turn_ids:
                    return True
        return False

    testLane = {}
    _testLids = []
    _debugLines = []
    # _debugLines = getDebugLaneIds()
    # _debugLines = getDebugLaneIds2()
    # _debugLines = getDebugLaneIds3()
    for lane in __lane_list:
        _laneId = lane["id"]["id"]

        _lane_turn = lane.get('turn')

        # 遍历osm的属性
        _data = {}
        for _k, _v in lane.items():
            if _k.startswith("osm_"):
                _data[_k[4:]] = _v

        # if _lane_turn is None:
        #     print(f"----------------{_laneId}: {_lane_turn}")
        if _lane_turn not in [None, 'NO_TURN', 'LEFT_TURN', 'RIGHT_TURN', 'LANE_CHANGE']:
            print(f"----------------{_laneId}: {_lane_turn}")
        _lane_direction = lane.get('direction')
        _predecessorIds = lane.get('predecessorId')
        _successorIds = lane.get('successorId')
        _laneBlockId = lane.get("blockId")
        _laneHid = lane.get("hid")

        _lane_type1 = lane.get('priorityValue', -1)

        laneType2Dict = {
            'NONE': 0,
            'PARKING': 1,
            'CITY_DRIVING': 2,
            'BIKING': 3,
            'SIDEWALK': 4
        }
        _lane_type2 = laneType2Dict.get(lane.get('type'), -1)

        __lanePoints = []
        for item in lane['centralCurve']['segment']:
            __lanePoints += item['lineSegment']['point']

        __lanePointsOriginal = __lanePoints

        if _lane_turn == 'NO_TURN':
            # 如果是直线那么进行优化，只取两个端点即可
            # __lanePoints = [__lanePoints[0], __lanePoints[-1]]
            pass

        # create svg str
        __lanePoints2 = __lanePoints
        # simplify curve line
        if _lane_turn != 'NO_TURN':
            __lanePoints2 = __lanePoints[::4]
            if __lanePoints2[-1] != __lanePoints[-1]:
                __lanePoints2.append(__lanePoints[-1])

        __l = len(__lanePoints2)
        if __l <= 0:
            continue
        # line: [{x,y},{...}]
        __lanePointsStr = ''
        __lanePointsStr2 = ''
        __lanePoints2_temp = __lanePoints2
        if simplifyCurveLane and _lane_turn != 'NO_TURN':
            # 如果开启了简化曲线，那么弯道也直接简化为直线
            __lanePoints2_temp = [__lanePoints2[0], __lanePoints2[-1]]

        for i, p in enumerate(__lanePoints2_temp):
            __x = -p['x'] if inverseXAxis else p['x']
            __y = -p['y'] if inverseYAxis else p['y']
            # __points_str += '%s,%s' % (round(__x, 2), round(__y, 2))
            # __lanePointsStr += '%s,%s' % (__x, __y)
            c = 2 if optimizeLine else 4
            __lanePointsStr += '%s,%s' % (round(__x, c), round(__y, c))
            if i != __l - 1:
                __lanePointsStr += ' '

            # __lanePointsStr2 += f"{'M' if i == 0 else 'L'}{round(__x, 1)},{round(__y, 1)}{' ' if i != __l - 1 else ''}"

        __lanePointsStr2 = ''
        xk = -1 if inverseXAxis else 1
        yk = -1 if inverseYAxis else 1
        for i in range(len(__lanePoints2_temp)):
            curP = __lanePoints2_temp[i]
            if i == 0:
                _x = str(round(xk*curP['x'], 2))
                _y = str(round(yk*curP['y'], 2))
                _y = _y if _y.startswith('-') else f" {_y}"
                __lanePointsStr2 = f"M{_x}{_y}l"
            else:
                preP = __lanePoints2_temp[i-1]
                _x = str(round(xk*curP['x'] - xk*preP['x'], 2))
                if _x.startswith('0.'):
                    _x = _x[1:]
                elif _x.startswith('-0.'):
                    _x = _x.replace('-0', '-')
                _y = str(round(yk*curP['y'] - yk*preP['y'], 2))
                if _y.startswith('0.'):
                    _y = _y[1:]
                elif _y.startswith('-0.'):
                    _y = _y.replace('-0', '-')

                if _x.startswith('-'):
                    __lanePointsStr2 += _x
                else:
                    __lanePointsStr2 += ' ' + _x

                if _y.startswith('-'):
                    __lanePointsStr2 += _y
                else:
                    __lanePointsStr2 += ' ' + _y

        _nextlaneIds = ""
        if _successorIds:
            _nextlaneIds = "/".join([item.get("id") for item in _successorIds])

        lanePointsObj = LanePoints(__lanePoints, __lanePointsStr, __lanePointsStr2, lane['length'],
                                   _lane_direction, _lane_turn,
                                   nextlaneIds=_nextlaneIds,
                                   data=_data)

        # if _laneId in _testLids:
        #     testLane[_laneId] = lanePointsObj

        # 记录所有lane的点及nextlane id
        __lanePointsAndNextLane[_laneId] = {"points": __lanePoints, "pointsObj": lanePointsObj, "nextLaneIds": [item.get("id") for item in _successorIds] if _successorIds else []}

        # 1. turn or curve
        if exportLevel == 'ALL' or (exportLevel == 'FORWARD' and _lane_direction != 'BACKWARD') or (exportLevel == 'BACKWARD' and _lane_direction != 'FORWARD'):
            if _lane_turn == 'NO_TURN':
                __lines_points_line[_laneId] = lanePointsObj
            else:
                __lines_points_curve[_laneId] = lanePointsObj

        # lane type1
        if _lane_type1 == type1:
            _lines_points_type[_laneId] = lanePointsObj

        # lane type2
        if _lane_type2 == type2:
            _lines_points_type2[_laneId] = lanePointsObj

        # 带z - heading的lane
        if checkEnableDict.get("withHeadingLine", True):
            if 'z' in __lanePoints[0]:
                _lines_points_with_heading[_laneId] = lanePointsObj

        # 蟹形
        # print(_lane_turn)
        # if _lane_turn == 'LANE_CHANGE' and 'z' in __lanePoints[0]:
        if checkEnableDict.get("isCrabLine", True):
            if _lane_turn is None and 'z' in __lanePoints[0]:
                _h0 = __lanePoints[0].get('z')
                _flag = True
                for _p in __lanePoints:
                    _h = _p.get('z')
                    if _h is None or abs(_h - _h0) >= 0.02:
                        _flag = False
                        break
                if _flag:
                    _lines_points_lanechange_isCrab[_laneId] = lanePointsObj

        # 2. wrong line
        # test 仅保留直线, 并且关系中没有直线的
        if checkEnableDict.get("connection", True):
            if (_predecessorIds is None or len(_predecessorIds) == 0) and (
                    _successorIds is None or len(_successorIds) == 0):
                _lines_points_both[_laneId] = lanePointsObj
            elif _predecessorIds is None or len(_predecessorIds) == 0:
                _lines_points_pre[_laneId] = lanePointsObj
            elif _successorIds is None or len(_successorIds) == 0:
                _lines_points_succ[_laneId] = lanePointsObj
        #
        # if checkEnableDict.get("connection", True) and _lane_turn == 'NO_TURN' and lanePointsObj.z2 is not None:
        #     if abs(lanePointsObj.z2) <= 0.1 or abs(abs(lanePointsObj.z2) - 3.14) <= 0.1:
        #         if not _hasNoTurn(_predecessorIds):
        #             _lines_points_pre[_laneId] = lanePointsObj
        #         if not _hasNoTurn(_successorIds):
        #             _lines_points_succ[_laneId] = lanePointsObj

        # 3. turn type
        if checkEnableDict.get("turn", True):
            if _lane_turn == 'LEFT_TURN':
                _lines_points_left[_laneId] = lanePointsObj
                # check error
                if _checkTurnLane(__lanePoints):
                    _lines_points_error_turn[_laneId] = lanePointsObj
            elif _lane_turn == 'RIGHT_TURN':
                _lines_points_right[_laneId] = lanePointsObj
                # check error
                if _checkTurnLane(__lanePoints):
                    _lines_points_error_turn[_laneId] = lanePointsObj

            elif _lane_turn == 'NO_TURN':
                # if lanePointsObj.z2 is not None and abs(lanePointsObj.z2) <= 0.1 or _laneId in ["lane_2412", "lane_1447"]:
                #     _lines_points_noturn[_laneId] = lanePointsObj
                _lines_points_noturn[_laneId] = lanePointsObj
                # 检查是否确实是直线 todo
                # if isStraight()
            elif _lane_turn == 'LANE_CHANGE':
                _lines_points_lanechange[_laneId] = lanePointsObj

            else:
                _lines_points_noneTurn[_laneId] = lanePointsObj
                # check error
                if _checkLaneChange(__lanePoints):
                    _lines_points_error_lanechange[_laneId] = lanePointsObj

        # check error curvature
        if checkCurvature and _lane_turn != 'NO_TURN':
            _curvatureInfo = CurvatureInfo(_laneId, __lanePoints, _lane_direction)
            if _checkCurvature(_curvatureInfo, requireCurvatureValue, requireDCurvatureValue):
                _errorCurvatureInfoList.append(_curvatureInfo)
                _lines_error_curvature[_laneId] = lanePointsObj

        # if _laneId in _debugLines:
        #     if _lane_turn == 'NO_TURN':
        #         _lines_error_curvature[_laneId] = lanePointsObj
        #         print(_laneId, "-"*30)

        # 4. direction
        if checkEnableDict.get("direction", True):
            if _lane_direction == 'FORWARD':
                _lines_points_forward[_laneId] = lanePointsObj
            elif _lane_direction == 'BACKWARD':
                _lines_points_backward[_laneId] = lanePointsObj
            elif _lane_direction == 'BIDIRECTION':
                _lines_points_bidirection[_laneId] = lanePointsObj
            else:
                _lines_points_noneDirection[_laneId] = lanePointsObj

        # blockId
        if checkEnableDict.get("blockLine", True):
            if _laneBlockId and ("all" in blockIds or _laneBlockId in blockIds):
                _lines_points_blockId[_laneId] = lanePointsObj
            if _laneHid and ("all" in heightIds or _laneHid in heightIds):
                _lines_points_blockId[_laneId] = lanePointsObj

        # 5.1 gap 只有所有都满足指定范围才标记
        # 5.2 gap error只要有一个大于maxGap2，那么就进行标记
        if checkEnableDict.get("pointGap", True):
            if __lanePointsOriginal and len(__lanePointsOriginal) >= 2:
                _isOk = True
                _isOk2 = True
                for i in range(len(__lanePointsOriginal) - 1):
                    x1 = float(__lanePointsOriginal[i].get('x'))
                    y1 = float(__lanePointsOriginal[i].get('y'))
                    x2 = float(__lanePointsOriginal[i + 1].get('x'))
                    y2 = float(__lanePointsOriginal[i + 1].get('y'))
                    _dd = math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
                    if not (minGap <= _dd <= maxGap):
                        _isOk = False
                    if _dd > maxGap2:
                        _isOk2 = False
                if _isOk:
                    __lines_points_gap[_laneId] = lanePointsObj
                if not _isOk2:
                    __lines_points_gap_error[_laneId] = lanePointsObj

    # 遍历连接关系，检查连接点的两直线的夹角是否正常
    _errorLanePoints = {}  # {"laneid":[{x,y}, {x, y}],[...]}
    if checkEnableDict.get("connection2", True):
        for key, item in __lanePointsAndNextLane.items():
            _curLaneId = key
            # if _curLaneId == "lane_314":
            #     print("test")
            _curLanePoints = item.get("points")
            _curLanePointsObj = item.get("pointsObj")
            _nextLaneIds = item.get("nextLaneIds")

            # if _curLaneId in ['lane_229', 'lane_485']:
            #     print('debug')
            #     _errorLanePoints[_curLaneId] = _curLanePoints

            # 遍历next lane
            if not _nextLaneIds or len(_nextLaneIds) <= 0 or not _curLanePoints or len(_curLanePoints) < 2:
                continue

            for _nextLaneId in _nextLaneIds:
                _nextLane = __lanePointsAndNextLane.get(_nextLaneId)
                _nextLanePoints = _nextLane.get("points")
                _nextLanePointsObj = _nextLane.get("pointsObj")
                if not _nextLanePoints or len(_nextLanePoints) < 2:
                    continue
                # 计算两条路的夹角
                # 若是地图中带角度则无需再计算
                if _curLanePoints[-1].get('z', None) is not None:
                    _angle1 = _curLanePoints[-1].get('z', None)
                else:
                    c1 = _curLanePoints[-2]
                    c2 = _curLanePoints[-1]
                    _angle1 = heading([float(c1.get('x')), float(c1.get('y'))], [float(c2.get('x')), float(c2.get('y'))])

                if _nextLanePoints[0].get('z', None) is not None:
                    _angle2 = _nextLanePoints[0].get('z', None)
                else:
                    n1 = _nextLanePoints[0]
                    n2 = _nextLanePoints[1]

                    _angle2 = heading([float(n1.get('x')), float(n1.get('y'))], [float(n2.get('x')), float(n2.get('y'))])

                try:
                    print(f"angle1: {_angle1}, angle2: {_angle2}")
                    _theta = _angle(_angle1, _angle2)
                    if _theta >= 6:  # 9 ~ 0.157rad
                        _errorLanePoints[_curLaneId] = _curLanePointsObj
                        _errorLanePoints[_nextLaneId] = _nextLanePointsObj
                except Exception as e:
                    # print(f"error: {[float(n1.get('x')), float(n1.get('y'))]}, {[float(n2.get('x')), float(n2.get('y'))]}")
                    # raise e
                    _theta = 0
                    print(f"angle1: {_angle1}, angle2: {_angle2}")

                # 若是连接处坐标不一样也认为有问题
                # if _curLanePoints[-1]["x"] != _nextLanePoints[0]["x"] or _curLanePoints[-1]["y"] != _nextLanePoints[0]["y"]:
                #     _errorLanePoints[_curLaneId] = _curLanePointsObj
                #     _errorLanePoints[_nextLaneId] = _nextLanePointsObj

                _dd = math.sqrt((_curLanePoints[-1]["x"] - _nextLanePoints[0]["x"]) ** 2 + (_curLanePoints[-1]["y"] - _nextLanePoints[0]["y"]) ** 2)
                if _dd > 0.02:
                    # _errorLanePoints[_curLaneId] = _curLanePointsObj
                    # _errorLanePoints[_nextLaneId] = _nextLanePointsObj
                    # print(f"_dd = {_dd}, {_curLaneId}[{_curLanePoints[-1]['x']}, {_curLanePoints[-1]['y']}] -> {_nextLaneId}[{_nextLanePoints[0]['x']}, {_nextLanePoints[0]['y']}]")
                    # 距离大于0.001之后再检查一下由这两个点计算出来的角度是否与这两个点的角度差过大

                    _angle3 = heading([_curLanePoints[-1]['x'], _curLanePoints[-1]['y']], [_nextLanePoints[0]['x'], _nextLanePoints[0]['y']])
                    print(f"angle1: {_angle1}, angle3: {_angle3}")
                    _theta = _angle(_angle1, _angle3)
                    if _theta >= 95:
                        print("-"*30)
                        print(f"_dd = {_dd}, angle3 = {round(_angle3, 4)}, angle1 = {round(_angle1, 4)}, theta = {round(_theta, 4)}")
                        print(f"_dd = {_dd}, {_curLaneId}[{_curLanePoints[-1]['x']}, {_curLanePoints[-1]['y']}] -> {_nextLaneId}[{_nextLanePoints[0]['x']}, {_nextLanePoints[0]['y']}]")
                        _errorLanePoints[_curLaneId] = _curLanePointsObj
                        _errorLanePoints[_nextLaneId] = _nextLanePointsObj
                    _theta = _angle(_angle2, _angle3)
                    if _theta >= 95:
                        print("-" * 30)
                        print(f"_dd = {_dd}, angle3 = {round(_angle3, 4)}, angle2 = {round(_angle2, 4)}, theta = {round(_theta, 4)}")
                        print(f"_dd = {_dd}, {_curLaneId}[{_curLanePoints[-1]['x']}, {_curLanePoints[-1]['y']}] -> {_nextLaneId}[{_nextLanePoints[0]['x']}, {_nextLanePoints[0]['y']}]")

                        _errorLanePoints[_curLaneId] = _curLanePointsObj
                        _errorLanePoints[_nextLaneId] = _nextLanePointsObj

    # _errorLanePoints = testLane

    return __lines_points_line, __lines_points_curve, \
        _lines_points_both, _lines_points_pre, _lines_points_succ, \
        _lines_points_left, _lines_points_right, _lines_points_noturn, _lines_points_lanechange, _lines_points_noneTurn, \
        _lines_points_forward, _lines_points_backward, _lines_points_bidirection, _lines_points_noneDirection, \
        _lines_points_blockId, \
        __lines_points_gap, __lines_points_gap_error, _errorLanePoints, _lines_points_type, _lines_points_type2, \
        _lines_points_with_heading, _lines_points_lanechange_isCrab, \
        _lines_points_error_turn, _lines_points_error_lanechange, \
        _lines_error_curvature, _errorCurvatureInfoList


def _filterSameLine(lanePoints: Dict[str, LanePoints]) -> Dict[str, LanePoints]:
    """
    如果起点终点组成的key一样，认为是同样的线，那么只保留一个
    :param lanePoints:
    :return:
    """
    _set = set()
    _dict = {}
    for _key, _item in lanePoints.items():
        _p1 = _item.points[0]
        _p2 = _item.points[-1]
        _k1 = f"{round(float(_p1['x']), 2)}_{round(float(_p1['y']), 2)}__{round(float(_p2['x']), 2)}_{round(float(_p2['y']), 2)}"
        _k2 = f"{round(float(_p2['x']), 2)}_{round(float(_p2['y']), 2)}__{round(float(_p1['x']), 2)}_{round(float(_p1['y']), 2)}"
        if _k1 not in _set and _k2 not in _set:
            _set.add(_k1)
            _set.add(_k2)
            _dict[_key] = _item
    return _dict


def createLinesNew2(lines_points, lineColor='#91cc7564', optimize=False, withName=False, inverseXAxis=False, inverseYAxis=True):
    s = ""
    for __laneId, __line in lines_points.items():
        __points_str = __line.pointsStr2
        _osm_attrs = []
        for k, v in __line.data.items():
            _osm_attrs.append(f'{k}="{v}"')
        _osm_str = " ".join(_osm_attrs)
        # s += f'<path name="{__laneId}" d="{__points_str}" {_osm_str} style="fill:none;stroke:{lineColor};stroke-width:1"/>'
        if withName:
            s += f'<path  name="{__laneId}" d="{__points_str}" {_osm_str} style="fill:none;stroke:{lineColor};stroke-width:1"/>'
        else:
            s += f'<path d="{__points_str}" {_osm_str} style="fill:none;stroke:{lineColor};stroke-width:1"/>'
    return s


def createLinesNew(lines_points, lineColor='#91cc7564', optimize=False, withName=False, inverseXAxis=False, inverseYAxis=True):
    s = ""
    d = ''
    for __laneId, __line in lines_points.items():
        d += __line.pointsStr2

    if withName:
        s += '<path name="%s_%s_%s" d="%s" fill="none" stroke="%s"/>' % (
            __laneId, __line.length, __line.direction, d, lineColor)
    else:
        s += '<path d="%s" fill="none" stroke="%s"/>' % (d, lineColor)

    return s


def createLines(lines_points, lineColor='#91cc7564', optimize=False, withName=False, inverseXAxis=False, inverseYAxis=True):
    s = ""
    for __laneId, __line in lines_points.items():
        if PATH:
            __points_str = __line.pointsStr2
            if withName:
                s += '<path name="%s_%s_%s" d="%s" style="fill:none;stroke:%s;stroke-width:1"/>' % (
                    __laneId, __line.length, __line.direction, __points_str, lineColor)
            else:
                s += '<path d="%s" style="fill:none;stroke:%s;stroke-width:1"/>' % (__points_str, lineColor)
        else:
            __points_str = __line.pointsStr
            if withName:
                s += '<polyline name="%s_%s_%s_%s_%s->%s" points="%s" style="fill:none;stroke:%s;stroke-width:1"/>' % (__laneId, __line.length, __line.direction, __line.turn, __line.start_end, __line.nextlaneIds, __points_str, lineColor)
            else:
                s += '<polyline points="%s" style="fill:none;stroke:%s;stroke-width:1"/>' % (__points_str, lineColor)
    return s


def __rotate(p, angle):
    """点旋转"""
    x = p[0]*math.cos(angle) + p[1]*math.sin(angle)
    y = -p[0]*math.sin(angle) + p[1]*math.cos(angle)
    return [x, y]


def __translate(p, p0):
    """点平移"""
    return [p[0] + p0[0], p[1] + p0[1]]


def __heading(p1, p2):
    """计算两个点的直线与x轴的夹角"""
    ret = 0.0
    try:
        if len(p1) == 2 and len(p2) == 2:
            a = (p2[0] - p1[0], p2[1] - p1[1])
            b = (1, 0)

            n1 = np.array(a)
            n2 = np.array(b)

            l1 = np.sqrt(n1.dot(n1))
            l2 = np.sqrt(n2.dot(n2))

            cosAngle = n1.dot(n2) / (l1 * l2)
            angle = np.arccos(cosAngle)

            aXb = np.cross(n1, n2)

            ret = (1 if aXb < 0 else -1) * angle
        else:
            raise Exception("Parameter is not Point ...")
    except:
        print(p1)
        print(p2)
        print(traceback.format_exc())
    return ret


def __isCurveLine(points):
    """判断给定的点是否是一条曲线，通过两端的点与中点的夹角来判断"""
    half_len_points = int(len(points) / 2)
    curve_heading_1 = __heading((points[0]['x'], points[0]['y']),
                                (points[half_len_points]['x'], points[half_len_points]['y']))
    curve_heading_2 = __heading((points[half_len_points]['x'], points[half_len_points]['y']),
                                (points[-1]['x'], points[-1]['y']))
    # 增加1/4位置的点进行判断
    index_1_4 = int(len(points) / 4)
    curve_heading_3 = __heading((points[index_1_4]['x'], points[index_1_4]['y']),
                                (points[half_len_points]['x'], points[half_len_points]['y']))
    curve_heading_4 = __heading((points[-index_1_4]['x'], points[-index_1_4]['y']),
                                (points[half_len_points]['x'], points[half_len_points]['y']))
    return abs(curve_heading_2 - curve_heading_1) > 0.0001 and abs(curve_heading_3 - curve_heading_4) > 0.0001


def __optimizeLine(points):
    """优化直线，减少直线的点"""
    if __isCurveLine(points):
        return points
    else:
        # 直线只保留三个点
        half_len_points = int(len(points) / 2)
        return [points[0], points[half_len_points], points[-1]]


def __getAngle(p1, p2):
    """计算旋转的角度，即与y轴的夹角"""
    __angel = 0
    x1 = p1['x']
    y1 = p1['y']
    x2 = p2['x']
    y2 = p2['y']
    dx = x2 - x1
    dy = y2 - y1
    if dy == 0:
        __angel = math.pi / 2 if dx > 0 else -math.pi / 2
    elif dy > 0:
        __angel = math.atan(dx / dy)
    else:
        __angel = math.atan(dx / dy) + math.pi
    return __angel


def __getArrowPoints(points, width):
    """获取箭头的坐标，三个顶点的坐标，points为点集，width为箭头的边长"""
    # 以原点计算得到的三角形顶点坐标
    p1 = [-width / 2, 0]
    p2 = [0, math.sqrt(3) * width / 2]
    p3 = [width/2, 0]
    hlen = int(len(points) / 2)
    m = [points[hlen]['x'], points[hlen]['y']]
    __angle = __getAngle(points[hlen], points[hlen + 1])
    # 点旋转
    p1 = __rotate(p1, __angle)
    p2 = __rotate(p2, __angle)
    p3 = __rotate(p3, __angle)
    # 平移
    p1 = __translate(p1, m)
    p2 = __translate(p2, m)
    p3 = __translate(p3, m)
    # 转换点的格式为{x,y}
    # p1 = __convertPoint(p1)
    # p2 = __convertPoint(p2)
    # p3 = __convertPoint(p3)
    return [p1, p2, p3]


def __getPoint(p, inverseXAxis, inverseYAxis):
    __x = -p[0] if inverseXAxis else p[0]
    __y = -p[1] if inverseYAxis else p[1]
    return round(__x, 1), round(__y, 1)


def createArrows(lines_points, arrowColor='#91cc7564', width=1.0, inverseXAxis: bool = False, inverseYAxis: bool = True) -> str:
    s = ""
    d = ""
    for __laneId, item in lines_points.items():
        __line = item.points
        __l = len(__line)
        if __l < 2:
            # 若是少于2个点则不绘制箭头
            continue
        if __l <= 2:
            # 两个点 - 直线，插入一个中点
            __line = [__line[0], {'x': (__line[0]['x'] + __line[1]['x'])/2.0, 'y': (__line[0]['y'] + __line[1]['y'])/2.0}, __line[1]]

        __points = __getArrowPoints(__line, width)  # 三个顶点
        _p1 = __getPoint(__points[0], inverseXAxis, inverseYAxis)
        _p2 = __getPoint(__points[1], inverseXAxis, inverseYAxis)
        _p3 = __getPoint(__points[2], inverseXAxis, inverseYAxis)
        d += f"M{_p1[0]} {_p1[1]}l{round(_p2[0] - _p1[0], 1)} {round(_p2[1] - _p1[1], 1)} {round(_p3[0] - _p2[0], 1)} {round(_p3[1] - _p2[1], 1)}Z"

    s = f'<path d="{d}" fill="none" stroke="{arrowColor}"/>'
    return s


def getSvgString(mapFileName: str,
                 lineDefaultColor: str = '#91cc7570',
                 lineDefaultColor2: str = '#91cc7520',
                 withName: bool = False,
                 inverseXAxis: bool = False,
                 inverseYAxis: bool = True,
                 arrowEnable: bool = True,
                 arrowColor: str = '#91cc7564',
                 wrongLineBothEnable: bool = False,
                 wrongLineBothColor: str = 'red',
                 wrongLinePreEnable: bool = False,
                 wrongLinePreColor: str = 'blue',
                 wrongLineSuccEnable: bool = False,
                 wrongLineSuccColor: str = 'orange',
                 noTurnEnable: bool = False,
                 noTurnColor: str = 'red',
                 turnEnable: bool = False,
                 turnColor: str = 'red',
                 laneChangeEnable: bool = False,
                 laneChangeColor: str = 'red',
                 forwardLineEnable: bool = False,
                 forwardLineColor: str = 'yellow',
                 backwardLineEnable: bool = False,
                 backwardLineColor: str = 'orange',
                 errorDirectionEnable: bool = False,
                 errorDirectionLineColor: str = 'red',
                 blockLineEnable: bool = False,
                 blockLineColor: str = 'red',
                 blockIds: List[str] = ["all"],
                 pointGapEnable: bool = False,
                 pointGapColor: str = 'red',
                 pointGapMinValue: float = 0.5,
                 pointGapMaxValue: float = float('inf'),
                 pointGapErrorEnable: bool = False,
                 pointGapErrorColor: str = 'red',
                 pointGapMaxValue2: float = 0.5,
                 optimize: bool = False,
                 errorLineEnable: bool = False,
                 errorLineColor: str = 'red',
                 type1: int = None,
                 type1LineColor: str = 'red',
                 type2: int = None,
                 type2LineColor: str = 'red',
                 withHeadingLineEnable: bool = False,
                 withHeadingLineColor: str = 'red',
                 isCrabLineEnable: bool = False,
                 isCrabLineColor: str = 'red',
                 errorLaneTurnEnable: bool = False,
                 errorLaneTurnColor: str = 'red',
                 errorLaneChangeEnable: bool = False,
                 errorLaneChangeColor: str = 'red',
                 errorCurvatureEnable: bool = False,
                 errorCurvatureColor: str = 'red',
                 requireCurvatureValue: float = 0.08,
                 requireDCurvatureValue: float = 0.01,
                 exportLevel: str = 'ALL',
                 simplifyCurveLane: bool = False,
                 optimizeLine: bool = False,
                 baseArrow: bool = True,
                 hids: str = '',
                 request=None
                 ) -> Tuple[str, List[CurvatureInfo]]:
    """
    根据传入参数生成svg图片的字符串
    :return: svg file string
    """
    t1 = time.time()

    checkEnableDict = {
        "connection": wrongLineBothEnable or wrongLinePreEnable or wrongLineSuccEnable,
        "connection2": errorLineEnable,
        "turn": turnEnable or noTurnEnable or laneChangeEnable,
        "errorLaneTurn": errorLaneTurnEnable,
        "errorLaneChange": errorLaneChangeEnable,
        "errorCurvature": errorCurvatureEnable,
        "direction": forwardLineEnable or backwardLineEnable or errorDirectionEnable,
        "withHeadingLine": withHeadingLineEnable,
        "isCrabLine": isCrabLineEnable,
        "pointGap": pointGapEnable or pointGapErrorEnable,
        "blockLine": blockLineEnable,
    }

    __lines_points_line, __lines_points_curve, \
        lines_points_1_wrong_both, lines_points_1_wrong_pre, lines_points_1_wrong_succ, \
        _lines_points_left, _lines_points_right, _lines_points_noturn, _lines_points_lanechange, _lines_points_none_turn, \
        _lines_points_forward, _lines_points_backward, _lines_points_bidirection, _lines_points_none_direction, \
        _lines_points_blockId, \
        _lines_point_gap, _lines_point_gap_error, _errorLanePoints, \
        _lines_points_type1, _lines_points_type2, \
        _lines_points_with_heading, _lines_points_lanechange_isCrab, \
        _lines_points_error_turn, _lines_points_error_lanechange, \
        _lines_error_curvature, _errorCurvatureInfoList = parseMapNew(mapFileName,
                                                                      pointGapMinValue, pointGapMaxValue, pointGapMaxValue2,
                                                                      type1, type2,
                                                                      inverseXAxis, inverseYAxis,
                                                                      13.0,
                                                                      errorCurvatureEnable,
                                                                      requireCurvatureValue,
                                                                      requireDCurvatureValue,
                                                                      exportLevel,
                                                                      simplifyCurveLane,
                                                                      optimizeLine,
                                                                      checkEnableDict,
                                                                      blockIds,
                                                                      hids)

    t2 = time.time()
    print(f"parse map span time {round((t2 - t1) * 1000, 3)} ms.")
    print(f"_errorLanePoints: {len(_errorLanePoints)}")

    svg = ""
    # withName = True
    t1 = time.time()
    svg += '<svg xmlns = "http://www.w3.org/2000/svg" version = "1.1">'
    # svg += '<g>'
    # map_at
    # baseArrow = False
    # arrowEnable = False

    # 对svg进行优化，如果起点_终点或终点_起点组成的key已经存在了，那么过滤掉
    if optimizeLine:
        __lines_points_line = _filterSameLine(__lines_points_line)
        __lines_points_curve = _filterSameLine(__lines_points_curve)

    # svg += createLinesNew(__lines_points_line, lineDefaultColor, optimize, withName, inverseXAxis, inverseYAxis)
    # svg += createLinesNew(__lines_points_curve, lineDefaultColor2, optimize, withName, inverseXAxis, inverseYAxis)
    svg += createLinesNew2(__lines_points_line, lineDefaultColor, optimize, withName, inverseXAxis, inverseYAxis)
    svg += createLinesNew2(__lines_points_curve, lineDefaultColor2, optimize, withName, inverseXAxis, inverseYAxis)

    # arrow
    if baseArrow:
        svg += createArrows(__lines_points_line, arrowColor, 1.0, inverseXAxis, inverseYAxis)
        svg += createArrows(__lines_points_curve, lineDefaultColor2, 1.0, inverseXAxis, inverseYAxis)
    # withName = True
    # wrong
    if wrongLineBothEnable:
        svg += createLines(lines_points_1_wrong_both, wrongLineBothColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(lines_points_1_wrong_both, wrongLineBothColor, 1.0, inverseXAxis, inverseYAxis)

    if wrongLinePreEnable:
        svg += createLines(lines_points_1_wrong_pre, wrongLinePreColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(lines_points_1_wrong_pre, wrongLinePreColor, 1.0, inverseXAxis, inverseYAxis)

    if wrongLineSuccEnable:
        svg += createLines(lines_points_1_wrong_succ, wrongLineSuccColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(lines_points_1_wrong_succ, wrongLineSuccColor, 1.0, inverseXAxis, inverseYAxis)

    # turn
    if turnEnable:
        svg += createLines(_lines_points_left, turnColor, optimize, withName, inverseXAxis, inverseYAxis)
        svg += createLines(_lines_points_right, turnColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_left, turnColor, 1.0, inverseXAxis, inverseYAxis)
            svg += createArrows(_lines_points_right, turnColor, 1.0, inverseXAxis, inverseYAxis)

    # no turn
    if noTurnEnable:
        svg += createLines(_lines_points_noturn, noTurnColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_noturn, noTurnColor, 1.0, inverseXAxis, inverseYAxis)

    # #lane change
    if laneChangeEnable:
        svg += createLines(_lines_points_none_turn, laneChangeColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_none_turn, laneChangeColor, 1.0, inverseXAxis, inverseYAxis)

    # error
    if errorLaneTurnEnable:
        svg += createLines(_lines_points_error_turn, errorLaneTurnColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_error_turn, errorLaneTurnColor, 1.0, inverseXAxis, inverseYAxis)

    if errorLaneChangeEnable:
        svg += createLines(_lines_points_error_lanechange, errorLaneChangeColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_error_lanechange, errorLaneChangeColor, 1.0, inverseXAxis, inverseYAxis)

    if errorCurvatureEnable:  # or True
        svg += createLines(_lines_error_curvature, errorCurvatureColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_error_curvature, errorCurvatureColor, 1.0, inverseXAxis, inverseYAxis)

    # direction
    if forwardLineEnable:
        svg += createLines(_lines_points_forward, forwardLineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_forward, forwardLineColor, 1.0, inverseXAxis, inverseYAxis)

    if backwardLineEnable:
        svg += createLines(_lines_points_backward, backwardLineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_backward, backwardLineColor, 1.0, inverseXAxis, inverseYAxis)

    if errorDirectionEnable:
        svg += createLines(_lines_points_none_direction, errorDirectionLineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_none_direction, errorDirectionLineColor, 1.0, inverseXAxis, inverseYAxis)

    if blockLineEnable:
        svg += createLines(_lines_points_blockId, blockLineColor, optimize, True, inverseXAxis, inverseYAxis)
        # if arrowEnable:
        #     svg += createArrows(_lines_points_blockId, blockLineColor, 1.0, inverseXAxis, inverseYAxis)

    # 连接角度问题 - 偏差过大不平滑
    if errorLineEnable:
        svg += createLines(_errorLanePoints, errorLineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_errorLanePoints, errorLineColor, 1.0, inverseXAxis, inverseYAxis)

    if type1 is not None:
        svg += createLines(_lines_points_type1, type1LineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_type1, type1LineColor, 1.0, inverseXAxis, inverseYAxis)

    if type2 is not None:
        svg += createLines(_lines_points_type2, type2LineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_type2, type2LineColor, 1.0, inverseXAxis, inverseYAxis)

    if withHeadingLineEnable:
        svg += createLines(_lines_points_with_heading, withHeadingLineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_with_heading, withHeadingLineColor, 1.0, inverseXAxis, inverseYAxis)

    if isCrabLineEnable:
        svg += createLines(_lines_points_lanechange_isCrab, isCrabLineColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_points_lanechange_isCrab, isCrabLineColor, 1.0, inverseXAxis, inverseYAxis)

    # _lines_points_bidirection_all = _lines_points_bidirection
    # _lines_points_bidirection_all.update(_lines_points_none_direction)
    # createLines(_lines_points_bidirection_all, f, lineColor='red', optimize=_optimize)

    # end points error
    # createLines(_lines_error, f, lineColor='red', optimize=optimize)

    if pointGapEnable:
        svg += createLines(_lines_point_gap, pointGapColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_point_gap, pointGapColor, 1.0, inverseXAxis, inverseYAxis)

    if pointGapErrorEnable:
        svg += createLines(_lines_point_gap_error, pointGapErrorColor, optimize, withName, inverseXAxis, inverseYAxis)
        if arrowEnable:
            svg += createArrows(_lines_point_gap_error, pointGapErrorColor, 1.0, inverseXAxis, inverseYAxis)
    # svg += '</g>'
    svg += '</svg>'
    t2 = time.time()
    print(f"create svg span time {round((t2 - t1) * 1000, 3)} ms.")

    return svg, _errorCurvatureInfoList


def export_osm_svg(osm_file: str):
    # osm_file 所在目录
    dir_path = os.path.dirname(osm_file)
    # osm_file 文件名
    osm_file_name = os.path.basename(osm_file)

    to_json = os.path.join(dir_path, f"raw_{osm_file_name}.json")
    to_svg = os.path.join(dir_path, f"raw_{osm_file_name}.svg")
    to_raw_path = os.path.join(dir_path, f"raw_path_{osm_file_name}.json")

    routing = Routing(osm_file, gen_graph=False)
    save_to_json(osm_to_json(routing), to_json)
    svg, _errorCurvatureInfoList = getSvgString(
        to_json,
    )
    with open(to_svg, "w") as f:
        f.write(svg)
    # delet json file
    os.remove(to_json)

    map_info = {}
    llts = lanelet_filter(routing.map.laneletLayer)
    for llt in llts:
        road_info = {
            "attrs": {},
            "points": [],
        }
        road_info["attrs"] = {k: v for k, v in llt.attributes.items()}
        for p in llt.centerline:
            road_info["points"].append([round(p.x, 3), round(p.y, 3)])
        map_info[llt.id] = road_info

    with open(to_raw_path, "w") as f:   
        json.dump(map_info, f, separators=(',', ':'))

def lanelet_filter(llt_s):
    t = []
    for llt in llt_s:
        if "drivable" not in llt.attributes or ("drivable" in llt.attributes and llt.attributes["drivable"].lower() != "true"):
                continue
        t.append(llt)
    return t

if __name__ == "__main__":
    # routing = Routing(f"map/Abuzhabi_QP_VPB_250509_V3.7.3.osm", gen_graph=False)
    # to_file = "map/map.json"
    # save_to_json(osm_to_json(routing), to_file)
    # svg, _errorCurvatureInfoList = getSvgString(
    #     to_file,
    # )
    # with open("map/map.svg", "w") as f:
    #     f.write(svg)
    export_osm_svg("map/fangzhen0610V1.5.osm")
