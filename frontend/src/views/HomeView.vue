<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import PixiGame from '../components/RoutingMap.vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Location } from '@element-plus/icons-vue'
import { useGlobalStore } from '../stores/globalStore'
// import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import LockArea from '@/components/LockArea.vue'
import LockAreaList from '@/components/LockAreaList.vue'
import AgentsManager from '@/components/AgentsManager.vue'
import VehicleList from '@/components/VehicleList.vue'
import WeightScaleConfig from '@/components/WeightScaleConfig.vue'
import PriorityConfig from '@/components/PriorityConfig.vue'
import SpeedFmsConfig from '@/components/SpeedFmsConfig.vue'
import Infos from '@/components/Infos.vue'

import ReplayConfig from '@/components/ReplayConfig.vue'
import ApplicationManager from '../routing_map/main.ts'
import { storeToRefs } from 'pinia'
import { useGlobalSettingsStore } from '@/stores/useLocalStorage'
import { useDynamicVpbStore } from '@/stores/dynamicVpbStore'
import { useManualPathStore } from '@/stores/manualPathStore'
import { useParkingPathStore } from '@/stores/parkingPathStore'

const dynamicVpbStore = useDynamicVpbStore()



const settingsStore = useGlobalSettingsStore()

// 获取响应式的 settings（需要使用 storeToRefs 保持响应性）
const { globalSettings } = storeToRefs(settingsStore)

// 声明全局接口
declare global {
  interface Window {
    updateClickPosition: (x: number, y: number) => void
    updatePointerPosition: (x: number, y: number) => void
  }
}

const globalStore = useGlobalStore()
const manualPathStore = useManualPathStore()
const parkingPathStore = useParkingPathStore()

// 直接使用 store 的 isReplay 和 appReady，通过 storeToRefs 保持响应性
const { isReplay, appReady } = storeToRefs(globalStore)
const { active: manualModeActive, planValid, vehicleId } = storeToRefs(manualPathStore)
const {
  active: parkingModeActive,
  planValid: parkingPlanValid,
  vehicleId: parkingVehicleId,
  previewPath: parkingPreviewPath,
  snapToLane: parkingSnapToLane,
} = storeToRefs(parkingPathStore)

// 监听地图显示状态
watch(() => globalSettings.value.map_show, (newValue, oldValue) => {
  // 防御性检查：确保 ApplicationManager 已初始化
  if (!appReady.value) return
  const ins = ApplicationManager.getInstance()
  if (ins && ins.map_container) {
    ins.map_container.visible = newValue
  }
})


// 监听底图显示状态
watch(() => globalSettings.value.background_image_show, (newValue, oldValue) => {
  // 防御性检查：确保 ApplicationManager 已初始化
  if (!appReady.value) return
  const ins = ApplicationManager.getInstance()
  if (ins && ins.app) {
    ins.toggleBackgroundImage(newValue)
  }
})

// 添加当前选中的菜单项
const currentMenu = ref('main-map')

// 滑块数值
const sliderValue = ref(0)

// 侧边栏控制
const isSidebarCollapsed = ref(false)
const sidebarWidth = ref(200)

// 处理侧边栏展开/收起
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  sidebarWidth.value = isSidebarCollapsed.value ? 0 : 200
}

// 处理菜单选择事件
const handleMenuSelect = (index: string) => {
  currentMenu.value = index
}


// 挂载时行, 从后台获取当前的global weight值
onMounted(() => {
  axios.get('/api/map/query/dynamic_weight_ratio')
    .then(response => {
      console.log('sliderValue 请求成功:', response.data)
      sliderValue.value = response.data.data

    })
    .catch(error => {
      console.error('请求失败:', error)
    })
})

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuVehicleId = ref('')

const openVehicleContextMenu = (detail: { vehicleId: string; x: number; y: number }) => {
  contextMenuVehicleId.value = detail.vehicleId
  contextMenuPosition.value = { x: detail.x, y: detail.y }
  contextMenuVisible.value = true
}

const closeVehicleContextMenu = () => {
  contextMenuVisible.value = false
}

const handleManualModeEnter = async (vehicle: string) => {
  try {
    if (parkingPathStore.active) {
      await handleParkingModeExit()
    }
    const response = await axios.post('/api/manual_path/enter', {
      vehicle_id: vehicle,
      origin: 'GUI',
    })
    if (response.data?.data?.ok) {
      manualPathStore.startMode(vehicle)
      const manager = getManagerSafe()
      manager?.setManualPathMode(true)
      ElMessage({ message: `已进入手控路径模式 (${vehicle})`, type: 'success' })
    } else {
      ElMessage({ message: '进入手控路径模式失败', type: 'error' })
    }
  } catch (error) {
    ElMessage({ message: `进入手控路径模式失败: ${error}`, type: 'error' })
  } finally {
    closeVehicleContextMenu()
  }
}

const handleManualModeExit = async () => {
  try {
    const response = await axios.post('/api/manual_path/exit', {
      vehicle_id: manualPathStore.vehicleId,
    })
    if (response.data?.data?.ok) {
      ElMessage({ message: '已退出手控路径模式', type: 'success' })
    } else {
      ElMessage({ message: response.data?.data?.message || '退出手控路径模式失败', type: 'warning' })
    }
  } catch (error) {
    ElMessage({ message: `退出手控路径模式失败: ${error}`, type: 'error' })
  } finally {
    manualPathStore.reset()
    const manager = getManagerSafe()
    manager?.setManualPathMode(false)
  }
}

const handleManualModeConfirm = async () => {
  if (!manualPathStore.preview) return
  try {
    const response = await axios.post('/api/manual_path/start', {
      vehicle_id: manualPathStore.vehicleId,
      points: manualPathStore.preview,
      origin: 'GUI',
    })
    if (response.data?.data?.ok) {
      ElMessage({ message: '手控路径任务已下发', type: 'success' })
      manualPathStore.setPreview(null, false)
      const manager = getManagerSafe()
      manager?.clearManualPathPreview()
    } else {
      ElMessage({ message: '手控路径任务下发失败', type: 'error' })
    }
  } catch (error) {
    ElMessage({ message: `手控路径任务下发失败: ${error}`, type: 'error' })
  }
}

const handleManualPathSelected = async (detail: { x: number; y: number; heading: number }) => {
  if (!manualPathStore.active) return
  manualPathStore.setTarget(detail)
  manualPathStore.planning = true
  try {
    const response = await axios.post('/api/manual_path/plan', {
      vehicle_id: manualPathStore.vehicleId,
      points: detail,
    })
    const ok = response.data?.data?.ok
    if (ok) {
      const target = response.data?.data?.target || detail
      manualPathStore.setPreview(target, true)
      const manager = getManagerSafe()
      manager?.updateManualPathPreview(target, true)
    } else {
      manualPathStore.setPreview(null, false)
      const manager = getManagerSafe()
      manager?.clearManualPathPreview()
      ElMessageBox.alert('当前选择的手控目标点无可规划路径', '路径规划失败', {
        confirmButtonText: '确定',
        type: 'warning',
      })
    }
  } catch (error) {
    manualPathStore.setPreview(null, false)
    const manager = getManagerSafe()
    manager?.clearManualPathPreview()
    ElMessageBox.alert('当前选择的手控目标点无可规划路径', '路径规划失败', {
      confirmButtonText: '确定',
      type: 'warning',
    })
  } finally {
    manualPathStore.planning = false
  }
}

const formatBridgeTimestamp = () => {
  const now = new Date()
  const pad = (value: number, len = 2) => value.toString().padStart(len, '0')
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours(),
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}${pad(now.getUTCMilliseconds(), 3)}Z`
}

const normalizeAngle = (angle: number) => {
  const twoPi = Math.PI * 2
  return ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI
}

const buildParkingBridgePayload = (
  vehicleId: string,
  path: { x: number; y: number; heading: number }[],
  reverseStart: boolean,
) => {
  const lastPoint = path[path.length - 1]
  const firstPoint = path[0]
  const transId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`
  const naviId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`
  const timestamp = formatBridgeTimestamp()
  const commandReferenceLines = [
    {
      command_id: 0,
      points: path.map((point) => ({
        x: point.x,
        y: point.y,
        z: 0,
        course_angle: reverseStart ? normalizeAngle(point.heading + Math.PI) : point.heading,
        heading_angle: reverseStart ? normalizeAngle(point.heading + Math.PI) : point.heading,
        s: 0,
        k: 0,
        d: 0,
        v: 2,
      })),
    },
  ]
  const startHeading = firstPoint.heading
  const endHeading = lastPoint.heading
  const guidanceDefaults = {
    direction: 2,
    deviation: null,
    speeds: {
      vmax: 200.0,
      vmaxDev: 1,
    },
    timeWindow: null,
    type: 'STRAIGHT',
    laneId: -1,
    equipmentLimit: {
      maxHeight: 11.2,
      minHeight: 11.1,
    },
  }
  return {
    qosCode: 2,
    topName: `veh/${vehicleId}/missioncmd/request`,
    payload: JSON.stringify({
      header: {
        transId,
        deviceId: vehicleId,
        timestamp,
      },
      body: {
        naviId,
        destination: {
          locationId: '01',
          refPosition: {
            longitude: lastPoint.x,
            latitude: lastPoint.y,
            elevation: 0,
          },
          locationType: 'YCTP',
          description: '01',
        },
        estimatedTime: '0',
        pathGuidance: {
          routeId: '1',
          points: [
            {
              pos: {
                longitude: firstPoint.x,
                latitude: firstPoint.y,
                elevation: 0,
              },
              heading: startHeading,
              ...guidanceDefaults,
            },
            {
              pos: {
                longitude: lastPoint.x,
                latitude: lastPoint.y,
                elevation: 0,
              },
              heading: endHeading,
              ...guidanceDefaults,
            },
          ],
        },
        routeUpdate: 0,
        referId: naviId,
        isFinalNavi: true,
        shortNavi: true,
        navi_task_type: 1,
        trans_id: transId,
        timestamp: Date.now(),
        task_id: naviId,
        map_firmware_id: '',
        backward_motion: reverseStart,
        dense_park: false,
        lane_sequence: [],
        route_graph: { nodes: [] },
        route_waypoints: [],
        command_reference_lines: commandReferenceLines,
        global_lane_sequence: [],
        global_destination: {},
      },
      type: 2,
    }),
  }
}

const handleParkingModeEnter = async (vehicle: string) => {
  try {
    if (manualPathStore.active) {
      await handleManualModeExit()
    }
    const response = await axios.post('/api/parking_path/enter', {
      vehicle_id: vehicle,
      origin: 'GUI',
    })
    if (response.data?.data?.ok) {
      parkingPathStore.startMode(vehicle)
      const manager = getManagerSafe()
      manager?.setParkingPathMode(true)
      manager?.setParkingPathVehicleId(vehicle)
      ElMessage({ message: `已进入寄车模式 (${vehicle})`, type: 'success' })
    } else {
      ElMessage({ message: response.data?.data?.message || '进入寄车模式失败', type: 'error' })
    }
  } catch (error) {
    ElMessage({ message: `进入寄车模式失败: ${error}`, type: 'error' })
  } finally {
    closeVehicleContextMenu()
  }
}

const handleParkingModeExit = async () => {
  try {
    const response = await axios.post('/api/parking_path/exit', {
      vehicle_id: parkingPathStore.vehicleId,
    })
    if (response.data?.data?.ok) {
      ElMessage({ message: '已退出寄车模式', type: 'success' })
    } else {
      ElMessage({ message: response.data?.data?.message || '退出寄车模式失败', type: 'warning' })
    }
  } catch (error) {
    ElMessage({ message: `退出寄车模式失败: ${error}`, type: 'error' })
  } finally {
    parkingPathStore.reset()
    const manager = getManagerSafe()
    manager?.setParkingPathMode(false)
    manager?.setParkingPathVehicleId('')
    manager?.clearParkingPathPreview()
    manager?.clearParkingObstacles()
  }
}

const handleParkingModeConfirm = async () => {
  if (!parkingPathStore.previewPath) return
  try {
    const payload = buildParkingBridgePayload(
      parkingPathStore.vehicleId,
      parkingPathStore.previewPath,
      parkingPathStore.reverseStart,
    )
    const response = await axios.post('/api/bridge/message', payload)
    if (response.data?.data?.ok) {
      ElMessage({ message: '寄车路径已下发', type: 'success' })
    } else {
      ElMessage({ message: response.data?.data?.message || '寄车路径下发失败', type: 'error' })
    }
  } catch (error) {
    ElMessage({ message: `寄车路径下发失败: ${error}`, type: 'error' })
  }
}

const handleParkingPathSelected = async (detail: { x: number; y: number; heading: number }) => {
  if (!parkingPathStore.active) return
  parkingPathStore.setTarget(detail)
  parkingPathStore.planning = true
  try {
    const response = await axios.post('/api/parking_path/plan', {
      vehicle_id: parkingPathStore.vehicleId,
      points: detail,
    })
    const ok = response.data?.data?.ok
    if (ok) {
      const path = response.data?.data?.path
      const reverseStart = Boolean(response.data?.data?.reverse_start)
      if (Array.isArray(path) && path.length > 1) {
        parkingPathStore.setPreviewPath(path, true, reverseStart)
        const manager = getManagerSafe()
        manager?.updateParkingPathPreviewPath(path, true, parkingPathStore.vehicleId)
        ElMessageBox.alert('混合A*路径生成成功，请确认下发', '路径规划完成', {
          confirmButtonText: '确定',
          type: 'success',
        })
      } else {
        parkingPathStore.setPreviewPath(null, false)
        const manager = getManagerSafe()
        manager?.clearParkingPathPreview()
        ElMessageBox.alert('混合A*路径生成失败', '路径规划失败', {
          confirmButtonText: '确定',
          type: 'warning',
        })
      }
    } else {
      parkingPathStore.setPreviewPath(null, false)
      const manager = getManagerSafe()
      manager?.clearParkingPathPreview()
      ElMessageBox.alert('混合A*路径生成失败', '路径规划失败', {
        confirmButtonText: '确定',
        type: 'warning',
      })
    }
  } catch (error) {
    parkingPathStore.setPreviewPath(null, false)
    const manager = getManagerSafe()
    manager?.clearParkingPathPreview()
    ElMessageBox.alert('混合A*路径生成失败', '路径规划失败', {
      confirmButtonText: '确定',
      type: 'warning',
    })
  } finally {
    parkingPathStore.planning = false
  }
}

const contextMenuHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail
  if (detail?.vehicleId) {
    openVehicleContextMenu(detail)
  }
}
const manualTargetHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail
  if (detail) {
    handleManualPathSelected(detail)
  }
}
const parkingTargetHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail
  if (detail) {
    handleParkingPathSelected(detail)
  }
}
const clickHandler = () => closeVehicleContextMenu()

watch(
  () => [appReady.value, manualModeActive.value],
  async ([ready, active]) => {
    if (!ready) return
    await nextTick()
    try {
      const manager = getManagerSafe()
      manager?.setManualPathMode(active)
    } catch (error) {
      console.error('手控模式同步失败:', error)
    }
  },
  { immediate: true },
)

watch(
  () => [appReady.value, parkingSnapToLane.value],
  async ([ready, enabled]) => {
    if (!ready) return
    await nextTick()
    const manager = getManagerSafe()
    manager?.setParkingPathSnapToLane(enabled)
  },
  { immediate: true },
)

watch(
  () => [appReady.value, parkingModeActive.value],
  async ([ready, active]) => {
    if (!ready) return
    await nextTick()
    try {
      const manager = getManagerSafe()
      manager?.setParkingPathMode(active)
    } catch (error) {
      console.error('寄车模式同步失败:', error)
    }
  },
  { immediate: true },
)

const parkingObstacleTimer = ref<number | null>(null)

const fetchParkingObstacles = async () => {
  try {
    const response = await axios.get('/api/parking_path/obstacles', {
      params: { vehicle_id: parkingPathStore.vehicleId },
    })
    if (!response.data?.data?.ok) return
    const points = response.data?.data?.points || []
    const manager = getManagerSafe()
    if (manager && Array.isArray(points)) {
      manager.updateParkingObstacles(points)
    }
  } catch (error) {
    // ignore polling errors
  }
}

watch(
  () => parkingModeActive.value,
  (active) => {
    if (!active) {
      if (parkingObstacleTimer.value) {
        clearInterval(parkingObstacleTimer.value)
        parkingObstacleTimer.value = null
      }
      const manager = getManagerSafe()
      manager?.clearParkingObstacles()
      return
    }
    fetchParkingObstacles()
    parkingObstacleTimer.value = window.setInterval(fetchParkingObstacles, 1000)
  },
  { immediate: true },
)

watch(
  () => [appReady.value, parkingModeActive.value, parkingPreviewPath.value],
  ([ready, active, previewPath]) => {
    if (!ready || !active) return
    const manager = getManagerSafe()
    if (!manager) return
    if (Array.isArray(previewPath) && previewPath.length > 1) {
      manager.updateParkingPathPreviewPath(previewPath, true, parkingPathStore.vehicleId)
    } else {
      manager.clearParkingPathPreview()
    }
  },
  { immediate: true },
)

const getManagerSafe = () => {
  try {
    if (!appReady.value) {
      return null
    }
    const manager = ApplicationManager.getInstance()
    if (!manager?.app?.canvas) {
      return null
    }
    return manager
  } catch (error) {
    console.error('获取 ApplicationManager 失败:', error)
    return null
  }
}

onMounted(() => {
  window.addEventListener('vehicle-contextmenu', contextMenuHandler)
  window.addEventListener('manual-path-target-selected', manualTargetHandler)
  window.addEventListener('parking-path-target-selected', parkingTargetHandler)
  window.addEventListener('click', clickHandler)
})

onUnmounted(() => {
  window.removeEventListener('vehicle-contextmenu', contextMenuHandler)
  window.removeEventListener('manual-path-target-selected', manualTargetHandler)
  window.removeEventListener('parking-path-target-selected', parkingTargetHandler)
  window.removeEventListener('click', clickHandler)
  if (parkingObstacleTimer.value) {
    clearInterval(parkingObstacleTimer.value)
  }
})

// 滑块变化处理函数
const handleSliderChange = async (value: number) => {
  try {
    // 发送 HTTP 请求，将滑块值传递给服务器
    const response = await axios.post('/api/map/update/dynamic_weight_ratio', {
      value: value,
    })
    ElMessage({ message: `set global sequece weight to ${value} ok`, type: 'success' })
    console.log('请求成功:', response.data)
  } catch (error) {
    ElMessage({ message: `set global sequece weight to error: ${error}`, type: 'error' })
    console.error('请求失败:', error)
  }
}

const onMapHide = () => {
  window.dispatchEvent(new CustomEvent('map-hide-click'))
}

const onAgentHide = () => {
  window.dispatchEvent(new CustomEvent('agent-hide-click'))
}

/**
 * 显示隐藏 self_area | ga_area |  pga_area |  pla_area
 */
const handleVisibleAgent = (type: string) => {

  window.dispatchEvent(new CustomEvent(type))
}

// const onImageHide = () => {
//   window.dispatchEvent(new CustomEvent('image-hide-click'))
// }

// 监听 isReplay 变化，同步到 sessionStorage 并清理回放状态
watch(isReplay, (newValue) => {
  globalStore.setIsReplay(newValue)
})

// 复制坐标到剪贴板
const copyClickPosition = () => {
  if (globalStore.positions.click) {
    const text = `${globalStore.positions.click[0].toFixed(3)}, ${globalStore.positions.click[1].toFixed(3)}`

    // 兼容性处理：优先使用 clipboard API，降级使用 execCommand
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        ElMessage({ message: '坐标已复制', type: 'success', duration: 500 })
      }).catch(() => {
        fallbackCopyText(text)
      })
    } else {
      fallbackCopyText(text)
    }
  }
}

// 降级复制方法（用于非安全上下文，如 HTTP 环境）
const fallbackCopyText = (text: string) => {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-9999px'
  textArea.style.top = '-9999px'
  textArea.setAttribute('readonly', '')  // 防止移动端弹出键盘
  document.body.appendChild(textArea)
  textArea.select()
  textArea.setSelectionRange(0, text.length)  // 兼容移动端
  try {
    // execCommand 已弃用但在非 HTTPS 环境下是唯一选择
    const successful = document.execCommand('copy')
    if (successful) {
      ElMessage({ message: '坐标已复制', type: 'success', duration: 500 })
    } else {
      ElMessage({ message: '复制失败', type: 'error' })
    }
  } catch (err) {
    ElMessage({ message: '复制失败', type: 'error' })
  }
  document.body.removeChild(textArea)
}

// 测量点功能
const measurePoint1 = ref('')
const measurePoint2 = ref('')
const showMeasurePoints = ref(false) // 控制测量点显示/隐藏，默认不显示

// 测量点选点模式
const selectingPoint = ref<'point1' | 'point2' | null>(null)

// 切换选点模式
const togglePointSelection = (pointId: 'point1' | 'point2') => {
  if (selectingPoint.value === pointId) {
    // 如果已经是选中状态，则取消
    selectingPoint.value = null
  } else {
    // 切换到选中状态
    selectingPoint.value = pointId
    // 确保测量点显示打开
    if (!showMeasurePoints.value) {
      showMeasurePoints.value = true
    }
  }
}

// 监听全局点击坐标变化，同步到选中的测量点
watch(() => globalStore.positions.click, (newClick) => {
  if (newClick && selectingPoint.value) {
    const [x, y] = newClick
    if (selectingPoint.value === 'point1') {
      measurePoint1.value = `${x.toFixed(3)}, ${y.toFixed(3)}`
    } else if (selectingPoint.value === 'point2') {
      measurePoint2.value = `${x.toFixed(3)}, ${y.toFixed(3)}`
    }
    // 保持选点模式，不自动取消
  }
})

// 计算距离
const measureDistance = computed(() => {
  const p1 = globalStore.measurePoints.point1
  const p2 = globalStore.measurePoints.point2
  if (!p1 || !p2) return null
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
})

// 计算角度（弧度）
const measureAngle = computed(() => {
  const p1 = globalStore.measurePoints.point1
  const p2 = globalStore.measurePoints.point2
  if (!p1 || !p2) return null
  return Math.atan2(p2.y - p1.y, p2.x - p1.x)
})

// 解析坐标字符串 "x,y" 或 "x, y"
const parseCoordinate = (input: string): { x: number; y: number } | null => {
  const trimmed = input.trim()
  if (!trimmed) return null

  // 支持逗号、空格、制表符等分隔符
  const parts = trimmed.split(/[,\s]+/).filter(p => p.length > 0)
  if (parts.length !== 2) return null

  const x = parseFloat(parts[0])
  const y = parseFloat(parts[1])

  if (isNaN(x) || isNaN(y)) return null
  return { x, y }
}

// 监听点1输入变化
watch(measurePoint1, (newValue) => {
  const coord = parseCoordinate(newValue)
  if (coord) {
    globalStore.setMeasurePoint('point1', coord.x, coord.y)
    if (!appReady.value) return
    const appManager = ApplicationManager.getInstance()
    if (appManager && appManager.updateMeasurePoint) {
      appManager.updateMeasurePoint('point1', coord.x, coord.y)
    }
  }
})

// 监听点2输入变化
watch(measurePoint2, (newValue) => {
  const coord = parseCoordinate(newValue)
  if (coord) {
    globalStore.setMeasurePoint('point2', coord.x, coord.y)
    if (!appReady.value) return
    const appManager = ApplicationManager.getInstance()
    if (appManager && appManager.updateMeasurePoint) {
      appManager.updateMeasurePoint('point2', coord.x, coord.y)
    }
  }
})

// 清除测量点
const clearMeasurePoints = () => {
  globalStore.clearMeasurePoints()
  measurePoint1.value = ''
  measurePoint2.value = ''
  if (!appReady.value) return
  const appManager = ApplicationManager.getInstance()
  if (appManager && appManager.clearMeasurePoints) {
    appManager.clearMeasurePoints()
  }
}

// 切换测量点显示
const toggleMeasurePoints = (visible: boolean) => {
  if (!appReady.value) return
  const appManager = ApplicationManager.getInstance()
  if (appManager && appManager.setMeasurePointsVisible) {
    appManager.setMeasurePointsVisible(visible)
  }
}

// 监听显示开关变化
watch(showMeasurePoints, (newValue) => {
  toggleMeasurePoints(newValue)
})

// Infos 组件引用
const infosRef = ref<InstanceType<typeof Infos> | null>(null)

// 打开 Infos 对话框
const openInfosDialog = () => {
  if (infosRef.value) {
    infosRef.value.handleOpen()
  }
}
</script>

<template>
  <div class="common-layout">
    <el-container>
      <el-aside class="the_side" :width="`${sidebarWidth}px`">
        <div class="sidebar-toggle" @click="toggleSidebar">
          <el-icon :class="{ 'is-collapsed': isSidebarCollapsed }">
            <component :is="isSidebarCollapsed ? 'ArrowRight' : 'ArrowLeft'" />
          </el-icon>
        </div>
        <div class="el-menu-wrapper">
          <el-menu :default-active="currentMenu" background-color="#f5f5f5" @select="handleMenuSelect"
            :collapse="isSidebarCollapsed">
            <el-menu-item index="main-map">
              <span>Main Map</span>
            </el-menu-item>

            <!-- <el-menu-item index="2">
              <span>Map Tools</span>
            </el-menu-item>

            <el-menu-item index="agents-manager">
              <span>Agent List</span>
            </el-menu-item> -->

            <el-menu-item index="lock-area">
              <span>Lock Area</span>
            </el-menu-item>

            <el-menu-item index="limit-area">
              <span>Traffic Control</span>
            </el-menu-item>

            <!-- 电子围栏 -->
            <el-menu-item index="geo-fence">
              <span>Geo-fence</span>
            </el-menu-item>

            <el-menu-item index="weight-scale-config">
              <span>Weight Scale Config</span>
            </el-menu-item>

            <el-menu-item index="priority-config">
              <span>Priority Config</span>
            </el-menu-item>

            <el-menu-item index="speed-config">
              <span>Speed Config</span>
            </el-menu-item>

            <!-- <el-menu-item index="Infos">
              <span>Infos</span>
            </el-menu-item> -->
          </el-menu>
        </div>
      </el-aside>

      <el-main>
        <el-container class="inner-container">
          <div class="top-section">
            <div v-if="currentMenu === 'main-map'" class="main-map-controls">
              <div v-if="manualModeActive" class="manual-mode-banner">
                <span class="manual-mode-text">手控路径模式 ({{ vehicleId }})</span>
                <el-button
                  type="primary"
                  size="small"
                  :disabled="!planValid"
                  @click="handleManualModeConfirm"
                >
                  确认
                </el-button>
                <el-button size="small" @click="handleManualModeExit">退出</el-button>
              </div>
              <div v-if="parkingModeActive" class="manual-mode-banner parking-mode-banner">
                <span class="manual-mode-text">寄车模式 ({{ parkingVehicleId }})</span>
                <el-button
                  type="primary"
                  size="small"
                  :disabled="!parkingPlanValid"
                  @click="handleParkingModeConfirm"
                >
                  确认
                </el-button>
                <el-button size="small" @click="handleParkingModeExit">退出</el-button>
                <span class="cell-label">吸附道路</span>
                <el-switch v-model="parkingSnapToLane" size="small" />
              </div>
              <!-- 两列布局 -->
              <div class="control-grid">
                <!-- 左上：坐标信息 -->
                <div class="control-cell">

                  <!-- <span class="cell-label">显示控制:</span>
                  <el-switch v-model="globalSettings.all_vpb_show" size="small" inline-prompt active-text="VPB"
                    inactive-text="VPB" />
                  <el-switch v-model="globalSettings.map_show" size="small" inline-prompt active-text="地图"
                    inactive-text="地图" />
                  <el-switch v-model="globalSettings.background_image_show" size="small" inline-prompt active-text="底图"
                    inactive-text="底图" />
                  <el-button type="primary" size="small" plain>刷新地图</el-button>
                  <el-button type="success" size="small" plain>重置视图</el-button> -->
                  <span class="cell-label">回放</span>
                  <el-switch
                        v-model="isReplay"
                        size="small"
                        class="ml-2"
                        inline-prompt
                        style="--el-switch-off-color: rgb(64, 158, 255)"
                        active-text="回放"
                        inactive-text="实时"
                      />

                  <span class="cell-label">all-vpb</span>
                  <el-tooltip effect="dark" content="切换刷新页面生效" placement="bottom">
                    <el-switch v-model="globalSettings.all_vpb_show" class="ml-2" inline-prompt size="small" />
                  </el-tooltip>
                  <span class="cell-label">地图</span>
                  <el-switch v-model="globalSettings.map_show" size="small"/>
                  <span class="cell-label">底图</span>
                  <el-switch v-model="globalSettings.background_image_show" size="small"/>

                  <el-button type="primary" plain size="small" @click="openInfosDialog">sys-info</el-button>

                  <span class="click-position">
                    click-p:
                    {{
                      globalStore.positions.click
                        ? `[ ${globalStore.positions.click[0].toFixed(3)}, ${globalStore.positions.click[1].toFixed(3)} ]`
                        : ''
                    }}
                    <el-icon v-if="globalStore.positions.click" class="copy-icon" @click="copyClickPosition"
                      title="复制坐标">
                      <CopyDocument />
                    </el-icon>
                  </span>

                </div>

                <!-- 右上：测量点 -->
                <div class="control-cell measure-cell">
                  <span class="cell-label">测量:</span>
                  <div class="measure-input-group">
                    <span class="point-label p1">P1</span>
                    <el-button
                      size="small"
                      :type="selectingPoint === 'point1' ? 'primary' : 'default'"
                      @click="togglePointSelection('point1')"
                      class="pick-button"
                      :icon="Location"
                    >
                    </el-button>
                    <el-input v-model="measurePoint1" placeholder="x, y" size="small" class="coord-input-single" />
                  </div>
                  <div class="measure-input-group">
                    <span class="point-label p2">P2</span>
                    <el-button
                      size="small"
                      :type="selectingPoint === 'point2' ? 'primary' : 'default'"
                      @click="togglePointSelection('point2')"
                      class="pick-button"
                      :icon="Location"
                    >
                    </el-button>
                    <el-input v-model="measurePoint2" placeholder="x, y" size="small" class="coord-input-single" />
                  </div>
                  <el-switch v-model="showMeasurePoints" size="small" inline-prompt active-text="显示" inactive-text="隐藏" />
                  <div class="measure-result" v-if="measureDistance !== null">
                    <span>距离: {{ measureDistance.toFixed(3) }}</span>
                    <span>角度: {{ measureAngle?.toFixed(3) }}</span>
                  </div>
                </div>

                <!-- 下方：跨两列 -->
                <div class="control-cell full-width">
                  <AgentsManager />
                </div>
              </div>
            </div>

            <!-- <div v-else-if="currentMenu === '2'">
              <span>
                click:
                {{
                  globalStore.positions.click
                    ? `[${globalStore.positions.click[0].toFixed(4)}, ${globalStore.positions.click[1].toFixed(4)}]`
                    : ''
                }}
              </span>
              <span style="margin-left: 20px">
                pointer:
                {{
                  globalStore.positions.pointer
                    ? `[${globalStore.positions.pointer[0].toFixed(4)}, ${globalStore.positions.pointer[1].toFixed(4)}]`
                    : ''
                }}
              </span>
            </div>

            <div v-else-if="currentMenu === 'agents-manager'">
              <AgentsManager />
            </div> -->

            <div v-else-if="currentMenu === 'lock-area'">
              <LockArea type="lock" text="Lock Area" />
            </div>

            <div v-else-if="currentMenu === 'limit-area'">
              <LockArea type="limit" text="Traffic Control" />
            </div>

            <div v-else-if="currentMenu === 'geo-fence'">
              <LockArea type="trigger" text="Geo-fence" />
            </div>

            <div v-else-if="currentMenu === 'weight-scale-config'">
              <div style="display: flex; align-items: center; gap: 20px;">
                <WeightScaleConfig />
                <div class="slider-container">
                  <span class="slider-label">区域均匀分布:</span>
                  <el-slider style="max-width: 600px;min-width: 400px;" placement="right" :show-tooltip="true"
                    v-model="sliderValue" :min="0" :max="1000" :step="0.1" @change="handleSliderChange" show-input
                    size="small" />
                </div>
              </div>
            </div>

            <div v-else-if="currentMenu === 'priority-config'">
              <PriorityConfig />
            </div>

            <div v-else-if="currentMenu === 'speed-config'">
              <SpeedFmsConfig />
            </div>

            <div v-else>
              <!-- <h3>请选择一个功能</h3> -->
            </div>
          </div>
          <!-- 下方主区域 -->
          <div class="main-map">
            <PixiGame />
          </div>

          <!-- <ReplayConfig /> -->
          <!-- 需要同时检查 appReady，避免刷新时 ApplicationManager 还未初始化 -->
          <div class="bottom-fotter" v-if="isReplay && appReady">
            <ReplayConfig />
          </div>
        </el-container>
      </el-main>
    </el-container>
  </div>

  <!-- 车辆列表对话框 -->
  <VehicleList />

  <!-- 锁闭区列表对话框 -->
  <LockAreaList type="lock" />

  <!-- 流量控制区域列表对话框 -->
  <LockAreaList type="limit" />

  <!-- 电子围栏区域列表对话框 -->
  <LockAreaList type="trigger" />

  <!-- Infos 信息对话框 -->
  <Infos ref="infosRef" />

  <div
    v-if="contextMenuVisible"
    class="vehicle-context-menu"
    :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
    @click.stop
  >
    <div class="menu-item" @click="handleManualModeEnter(contextMenuVehicleId)">进入手控路径模式</div>
    <div class="menu-item" @click="handleParkingModeEnter(contextMenuVehicleId)">进入寄车模式</div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.common-layout {
  height: 100vh;
  width: 100%;
  display: flex;
}

.el-container {
  flex: 1;
  display: flex;
}

/* 侧边栏 - 已隐藏 */
/* .the_side {
  display: none;
} */

.el-main {
  flex: 1;
  padding: 0;
  background-color: #fff;
  border-left: 2px solid #dcdfe6;
}

/* Element Plus 组件样式覆盖 */
:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item.is-active) {
  background-color: #e3f3ff !important;
  color: #000 !important;
}

/* 主容器结构 */
.inner-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.divider {
  height: 1px;
  background-color: #dcdfe6;
  width: 100%;
}

.top-section {
  margin-bottom: 10px;
}

.main-map {
  flex: 1;
  position: relative;
}

.bottom-fotter {
  height: 80px;
}

/* Main Map 控制面板样式 */
.main-map-controls {
  width: 100%;
}

.control-grid {
  display: grid;
  grid-template-columns: minmax(auto, max-content) minmax(0, 1fr);
  gap: 4px;
}

.control-cell.full-width {
  grid-column: 1 / -1;
}

.control-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  min-width: 0;
}

.manual-mode-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 6px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  color: #ad6800;
  font-weight: 600;
}

.parking-mode-banner {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  color: #0958d9;
}

.manual-mode-text {
  display: inline-flex;
  align-items: center;
}

.control-cell .cell-label {
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  margin-right: 4px;
  flex-shrink: 0;
}

.control-cell .click-position {
  display: inline-flex;
  align-items: center;
  width: 240px;
  /* font-family: monospace; */
  flex-shrink: 0;
}

.control-cell .click-position .copy-icon {
  margin-left: 4px;
  cursor: pointer;
  color: #909399;
  font-size: 14px;
  transition: color 0.2s;
}

.control-cell .click-position .copy-icon:hover {
  color: #409eff;
}

/* 测量点样式 */
.measure-cell {
  flex-wrap: wrap;
}

.measure-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.measure-input-group .pick-button {
  min-width: 32px;
  padding: 8px;
}

.measure-input-group .point-label {
  font-weight: bold;
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.measure-input-group .point-label.p1 {
  color: #00bfff;
}

.measure-input-group .point-label.p2 {
  color: #a578ff;
}

.measure-input-group .coord-input-single {
  width: 140px;
}

.measure-input-group :deep(.el-input__inner) {
  text-align: center;
  font-size: 14px;
}

.measure-result {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #606266;
  background-color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

/* 滑块相关样式 */
.slider-container {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: nowrap;
}

.slider-container .slider-label {
  white-space: nowrap;
  flex-shrink: 0;
}

.label-and-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-demo-block {
  max-width: 400px;
  display: flex;
  align-items: center;
}

/* .el-slider {
  max-width: 200px;
} */
.slider-demo-block .el-slider {
  margin-top: 0;
  margin-left: 12px;
  max-width: 200px;
}

.slider-demo-block .demonstration {
  font-size: 14px;
  /* color: var(--el-text-color-secondary); */
  line-height: 44px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0;
}

.slider-demo-block .demonstration+.el-slider {
  flex: 0 0 70%;
}

/* 侧边栏样式 */
.the_side {
  position: relative;
  transition: width 0.3s ease;
  overflow: visible;
  background-color: #f5f5f5;
}

/* 侧边栏切换按钮样式 */
.sidebar-toggle {
  position: absolute;
  right: -4px;
  top: 30%;
  transform: translateY(-50%);
  width: 8px;
  height: 60px;
  background-color: #409eff;
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 400;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: none;
  pointer-events: auto;
}

.sidebar-toggle:hover {
  background-color: #66b1ff;
  width: 12px;
  right: -6px;
}

.sidebar-toggle .el-icon {
  font-size: 12px;
  color: #ffffff;
  transition: none;
  opacity: 0.8;
}

.sidebar-toggle:hover .el-icon {
  opacity: 1;
}

/* 确保菜单在收起状态下也能正常显示 */
:deep(.el-menu) {
  border-right: none;
  transition: width 0.3s ease;
}

:deep(.el-menu--collapse) {
  width: 64px;
}

/* 添加一个容器来包裹菜单，确保菜单内容正确隐藏 */
.el-menu-wrapper {
  width: 100%;
  overflow: hidden;
  transition: width 0.3s ease;
}

/* 车辆控制按钮包装器样式 */
.vehicle-controls-wrapper {
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.bottom-fotter {
  background-color: #fff;
}

.vehicle-context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 160px;
  background: #ffffff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
}

.vehicle-context-menu .menu-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
}

.vehicle-context-menu .menu-item:hover {
  background: #f5f7fa;
}
</style>
