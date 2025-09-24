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
    positions,
    setPosition,
    getPosition,
    clearPositions,
  }
})
