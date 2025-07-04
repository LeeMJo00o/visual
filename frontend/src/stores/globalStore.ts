import { defineStore } from 'pinia'
import { ref } from 'vue'

export type PositionType = 'click' | 'pointer' | string

export const useGlobalStore = defineStore('global', () => {
  // 所有坐标相关数据
  const positions = ref<Record<string, [number, number] | null>>({
    click: null,
    pointer: null,
  })

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
    positions,
    setPosition,
    getPosition,
    clearPositions,
  }
})
