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

  // 回放模式下用于顶部时间显示的状态
  // 当前回放时间点（毫秒时间戳）。当未选择回放文件时为 null。
  const replayCurrentTime = ref<number | null>(null)
  // 当前选择的回放文件名。为空表示尚未选择文件。
  const replaySelectedFile = ref<string>('')

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

  function setIsReplay(value?: boolean) {
    sessionStorage.setItem('isReplay', (value ? value : !isReplay.value).toString())
    isReplay.value = value ? value : !isReplay.value

    // 退出回放时清理回放显示状态，避免顶部时间残留
    if (!isReplay.value) {
      replayCurrentTime.value = null
      replaySelectedFile.value = ''
    }
  }

  function setReplaySelectedFile(fileName: string) {
    replaySelectedFile.value = fileName || ''
    // 未选择文件时，顶部只显示 [RE]，不显示时间
    if (!replaySelectedFile.value) {
      replayCurrentTime.value = null
    }
  }

  function setReplayCurrentTime(t: number | null) {
    replayCurrentTime.value = t
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

  return {
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
  }
})
