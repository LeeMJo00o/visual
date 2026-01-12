import { defineStore } from 'pinia'
import { ref } from 'vue'

export type PositionType = 'click' | 'pointer' | string

export const useGlobalStore = defineStore('global', () => {
  // 所有坐标相关数据
  const positions = ref<Record<string, [number, number] | null>>({
    click: null,
    pointer: null,
  })

  const isReplay = ref<boolean>(sessionStorage.getItem('isReplay') === 'true' ? true : false)

  // ApplicationManager 初始化完成标志
  // 其他组件应在 appReady 为 true 后才能安全调用 ApplicationManager.getInstance()
  const appReady = ref<boolean>(false)

  function setAppReady(value: boolean) {
    appReady.value = value
    console.log('ApplicationManager ready:', value)
  }

  // 回放模式下用于顶部时间显示的状态
  // 当前回放时间点（毫秒时间戳）。当未选择回放文件时为 null。
  // 使用 localStorage 持久化，跨标签页共享进度
  const savedReplayTime = localStorage.getItem('replayCurrentTime')
  const replayCurrentTime = ref<number | null>(savedReplayTime ? Number(savedReplayTime) : null)
  // 当前选择的回放文件名。为空表示尚未选择文件。
  // 使用 localStorage 持久化，跨标签页共享
  const replaySelectedFile = ref<string>(localStorage.getItem('replaySelectedFile') || '')

  //  回放数据
  const replayData = ref<any[]>([])
  const speedConfig = ref<any>(null)
  const weightConfig = ref<any>(null)

  const priorityConfig = ref<any>({})

  function setPriorityConfig(config: any) {
    priorityConfig.value = config
  }

  function setWeightConfig(config: any) {
    weightConfig.value = config
  }

  function setSpeedConfig(config: any) {
    speedConfig.value = config
  }
  function clearReplayData() {
    replayData.value = []
  }
  function setReplayData(data: any[]) {
    replayData.value = data
  }

  function setIsReplay(value: boolean) {
    isReplay.value = value
    sessionStorage.setItem('isReplay', value.toString())

    // 退出回放时清理回放显示状态，避免顶部时间残留
    // 注意：不清理 localStorage，保留文件和进度供其他标签页使用
    if (!value) {
      replayCurrentTime.value = null
      replaySelectedFile.value = ''
    }
  }

  function setReplaySelectedFile(fileName: string) {
    replaySelectedFile.value = fileName || ''
    // 持久化到 localStorage，跨标签页共享
    if (replaySelectedFile.value) {
      localStorage.setItem('replaySelectedFile', replaySelectedFile.value)
    } else {
      localStorage.removeItem('replaySelectedFile')
      // 未选择文件时，顶部只显示 [RE]，不显示时间
      replayCurrentTime.value = null
      localStorage.removeItem('replayCurrentTime')
    }
  }

  function setReplayCurrentTime(t: number | null) {
    replayCurrentTime.value = t
    // 持久化到 localStorage，跨标签页共享进度
    if (t !== null) {
      localStorage.setItem('replayCurrentTime', t.toString())
    } else {
      localStorage.removeItem('replayCurrentTime')
    }
  }

  function getIsReplay() {
    return isReplay.value
  }

  // 设置某种类型的坐标
  function setPosition(type: PositionType, x: number, y: number) {
    positions.value[type] = [x, y]
  }

  // 获取某种类型的坐标
  function getPosition(type: PositionType) {
    return positions.value[type]
  }

  // 清空所有坐标
  function clearPositions() {
    Object.keys(positions.value).forEach((key) => {
      positions.value[key] = null
    })
  }

  // 测量点功能：两个点用于计算距离和角度
  const measurePoints = ref<{
    point1: { x: number; y: number } | null
    point2: { x: number; y: number } | null
  }>({
    point1: null,
    point2: null,
  })

  function setMeasurePoint(pointId: 'point1' | 'point2', x: number, y: number) {
    measurePoints.value[pointId] = { x, y }
  }

  function clearMeasurePoints() {
    measurePoints.value.point1 = null
    measurePoints.value.point2 = null
  }

  // 计算两点距离
  function getMeasureDistance(): number | null {
    const p1 = measurePoints.value.point1
    const p2 = measurePoints.value.point2
    if (!p1 || !p2) return null
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
  }

  // 计算两点角度（弧度，从p1指向p2）
  function getMeasureAngle(): number | null {
    const p1 = measurePoints.value.point1
    const p2 = measurePoints.value.point2
    if (!p1 || !p2) return null
    return Math.atan2(p2.y - p1.y, p2.x - p1.x)
  }

  return {
    // ApplicationManager 初始化状态
    appReady,
    setAppReady,

    priorityConfig,
    setPriorityConfig,
    weightConfig,
    setWeightConfig,
    speedConfig,
    setSpeedConfig,
    replayData,
    setReplayData,
    clearReplayData,
    isReplay,
    setIsReplay,
    getIsReplay,

  // replay time display state
  replayCurrentTime,
  replaySelectedFile,
  setReplayCurrentTime,
  setReplaySelectedFile,
    positions,
    setPosition,
    getPosition,
    clearPositions,

    // 测量点
    measurePoints,
    setMeasurePoint,
    clearMeasurePoints,
    getMeasureDistance,
    getMeasureAngle,
  }
})
