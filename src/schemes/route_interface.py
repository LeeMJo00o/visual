from typing import Any
from pydantic import BaseModel
from enum import IntEnum, StrEnum


class UpdateTaskType(StrEnum):
    NORMAL = ""  # normal update
    ARRIVED = "ARRIVED"  # the vehicle arrived at dest
    CANCEL = "CANCEL"  # mission has been aborted
    GHOST = "GHOST"  # set the vehicle to ghost
    ENTITY = "ENTITY"  # set the vehicle to entity
    LOCK_AREA = "LOCK_AREA"  # vehicle current doesn't have mission
    SHORT_NAVI = "shortnavi"  # fake navi, generate two points of a stright line
    GHOST_REMOVE = "GHOST_REMOVE"  # remove ghost
    ESTOP = "ESTOP"  # emergency stop
    RECYCLE_OK = "RECYCLE_OK"
    RECYCLE_WAIT = "RECYCLE_WAIT"
    RECYCLE_REJECT = "RECYCLE_REJECT"
    STOPPED = "STOPPED"
    REPLANNING = "RE-PLANNING"


class RecycleType(StrEnum):
    CANCEL = "CANCEL"
    ESTOP = "ESTOP"
    PRIORITY = "PRIORITY"
    BLAME = "BLAME"
    LONG_PATH_CHANGE = "LONG_PATH_CHANGE"
    SHORT_PATH_CHANGE = "SHORT_PATH_CHANGE"


class DeviceType(IntEnum):
    QTRUCK = 1
    QPILOT = 2
    ETRUCK = 3


class TrajType(IntEnum):
    SHORT = 1
    LONG = 2
    ROUTE_GRAPH = 3


class StartPose(BaseModel):
    x: float
    y: float
    heading: float
    trailer_x: float | None = 0
    trailer_y: float | None = 0
    trailer_heading: float | None = 0


class EndPose(BaseModel):
    x: float
    y: float
    heading: float
    bidirection: int | None = 0


class SelfOvertake(BaseModel):
    status: bool | None = False
    obj_lane_id: str | None = ""
    description: str | None = ""


class Pose(BaseModel):
    x: float
    y: float
    theta: float


class Pose2(BaseModel):
    x: float
    y: float
    theta: float
    tx: float = 0
    ty: float = 0
    tyaw: float = 0


class UpdateRequest(BaseModel):
    device_id: str
    trans_id: str
    task_id: str
    action: int
    timestamp: int
    start_pose: StartPose
    end_pose: EndPose
    block_id: str | None = ""
    stack_id: str | None = ""
    navi_poses: list[Pose] = []
    navi_traj: list[Pose2] = []
    device_type: int | None = 1
    traj_type: str | None = "points"
    task_type: str | None = ""
    vessel_info: dict | None = {}
    passing_location: list | None = []
    arrive: bool | None = False
    self_overtake: SelfOvertake | None = {}
    action: int | None = 0
    force_overtake: int | None = 0
    force_overtake_for_gui: int | None = 0
    reverse: bool | None = False
    via: int = 0
    version: int = 2


class NaviStatusRequest(BaseModel):
    device_id: str
    trans_id: str


class UpdateResponseForPathRecycle(BaseModel):
    trans_id: str = ""
    timestamp: int = 0
    task_id: str = ""
    error_msg: str = "Fail to update navigation info"
    error_data: list = []
    msg: str | None = ""
    long_path_updated: bool = False
    short_path_updated: bool = False
    special_navi_is_finished: bool = False
    nearest_navi_pose: Any = None
    reverse_done: bool | None = False
    recycle_type:  str = ""
    code: int = 200


class UpdateResponse(BaseModel):
    trans_id: str = ""
    timestamp: int = 0
    task_id: str = ""
    error_msg: str = "Fail to update navigation info"
    error_data: list = []
    msg: str | None = ""
    long_path_updated: bool = False
    short_path_updated: bool = False
    special_navi_is_finished: bool = False
    nearest_navi_pose: Any = None
    reverse_done: bool | None = False
    code: int = 200


class GetPathRequest(BaseModel):
    device_id: str
    trans_id: str
    task_id: str
    timestamp: int
    traj_type: int
    destination: dict
    device_type: int = 3


class Version (IntEnum):
    STANDARD = 1
    LEGACY = 2


class WellTrajType(StrEnum):
    SHORT = "short"
    LONG = "long"
    ROUTE_GRAPH = ""

class GetTrajRequest(BaseModel):
    device_id: str = ""
    device_type: str = ""
    map_firmware_id: str = ""
    trans_id: str|int = ""
    timestamp: int|float = 0
    task_id: str | int = ""
    task_type: int = 0      # 未用到
    traj_type: str = ""     # “”: route graph; "short": short traj; "long": long traj