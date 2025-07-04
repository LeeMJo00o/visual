import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApplicationManager } from '../routing_map/main'

export type PositionType = 'click' | 'pointer' | string

// 定义车辆接口
export interface Vehicle {
  vehicle_id: string
  position: {
    x: number
    y: number
    theta: number
  }
  targetPosition: {
    x: number
    y: number
    theta: number
  }
  isAnimating: boolean
  color: string
  isShow: boolean
}

export const useGlobalStore = defineStore('global', () => {
  // 所有坐标相关数据
  const positions = ref<Record<string, [number, number] | null>>({
    click: null,
    pointer: null,
  })

  // 车辆管理对话框状态
  const vehicleDialogVisible = ref(false)
  const vehicles = ref<Vehicle[]>([])
  const selectedVehicle = ref<Vehicle | null>(null)

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

  // 获取ApplicationManager实例
  function getApplicationManager(): ApplicationManager | null {
    return (
      (window as Window & { __applicationManagerInstance?: ApplicationManager })
        .__applicationManagerInstance || null
    )
  }

  // 更新车辆列表
  function updateVehicleList() {
    const manager = getApplicationManager()
    if (manager && manager.agents) {
      vehicles.value = Object.values(manager.agents)
        .map((agent) => {
          // 检查车辆是否可见（通过检查graphics的visible属性）
          const isVisible = agent.graphics ? agent.graphics.visible : true

          return {
            vehicle_id: agent.vehicle_id,
            position: { ...agent.position },
            targetPosition: { ...agent.targetPosition },
            isAnimating: agent.isAnimating,
            color: agent.color,
            isShow: isVisible,
          }
        })
        .sort((a, b) => {
          // 按照vehicle_id进行正序排序
          return a.vehicle_id.localeCompare(b.vehicle_id)
        })
    }
  }

  // 选择车辆
  function selectVehicle(vehicle: Vehicle) {
    selectedVehicle.value = vehicle
  }

  // 处理状态变化
  function handleStatusChange(vehicle: Vehicle) {
    const manager = getApplicationManager()
    if (manager && manager.agents && manager.agents[vehicle.vehicle_id]) {
      const agent = manager.agents[vehicle.vehicle_id]

      // 控制车辆及其相关元素的显示/隐藏
      if (agent.graphics) {
        agent.graphics.visible = vehicle.isShow
      }
      if (agent.graph_short_path) {
        agent.graph_short_path.visible = vehicle.isShow
      }
      if (agent.graph_long_path) {
        agent.graph_long_path.visible = vehicle.isShow
      }
      if (agent.text) {
        agent.text.visible = vehicle.isShow
      }

      console.log(`车辆 ${vehicle.vehicle_id} ${vehicle.isShow ? '显示' : '隐藏'}`)
    }
  }

  // 显示所有车辆
  function showAllVehicles() {
    // 将所有车辆的isShow设置为true
    vehicles.value.forEach((vehicle) => {
      vehicle.isShow = true
    })

    // 更新实际的显示状态
    const manager = getApplicationManager()
    if (manager && manager.agents) {
      Object.values(manager.agents).forEach((agent) => {
        if (agent.graphics) {
          agent.graphics.visible = true
        }
        if (agent.graph_short_path) {
          agent.graph_short_path.visible = true
        }
        if (agent.graph_long_path) {
          agent.graph_long_path.visible = true
        }
        if (agent.text) {
          agent.text.visible = true
        }
      })
    }
    console.log('显示所有车辆')
  }

  // 隐藏所有车辆
  function hideAllVehicles() {
    // 将所有车辆的isShow设置为false
    vehicles.value.forEach((vehicle) => {
      vehicle.isShow = false
    })

    // 更新实际的显示状态
    const manager = getApplicationManager()
    if (manager && manager.agents) {
      Object.values(manager.agents).forEach((agent) => {
        if (agent.graphics) {
          agent.graphics.visible = false
        }
        if (agent.graph_short_path) {
          agent.graph_short_path.visible = false
        }
        if (agent.graph_long_path) {
          agent.graph_long_path.visible = false
        }
        if (agent.text) {
          agent.text.visible = false
        }
      })
    }
    console.log('隐藏所有车辆')
  }

  // 显示/隐藏车辆对话框
  function toggleVehicleDialog() {
    vehicleDialogVisible.value = !vehicleDialogVisible.value
  }

  return {
    positions,
    setPosition,
    getPosition,
    clearPositions,
    // 车辆管理相关
    vehicleDialogVisible,
    vehicles,
    selectedVehicle,
    getApplicationManager,
    updateVehicleList,
    selectVehicle,
    handleStatusChange,
    showAllVehicles,
    hideAllVehicles,
    toggleVehicleDialog,
  }
})
