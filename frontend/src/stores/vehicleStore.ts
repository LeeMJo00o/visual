import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import ApplicationManager from '../routing_map/main'

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

export const useVehicleStore = defineStore('vehicle', () => {
  // 车辆管理对话框状态
  const vehicleDialogVisible = ref(false)
  const vehicles = ref<Vehicle[]>([])
  const selectedVehicle = ref<Vehicle | null>(null)

  // 路径显示状态
  const allShortPathsVisible = ref(true)
  const allLongPathsVisible = ref(true)

  // 计算属性
  const vehicleCount = computed(() => vehicles.value.length)

  const allVehiclesVisible = computed({
    get: () => vehicles.value.length > 0 && vehicles.value.every((vehicle) => vehicle.isShow),
    set: () => {
      // 这个 setter 不会被直接调用，因为我们使用 @change 事件
    },
  })

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
        // 短路径的显示状态 = 车辆显示状态 AND 全局短路径开关状态
        agent.graph_short_path.visible = vehicle.isShow && allShortPathsVisible.value
      }
      if (agent.graph_long_path) {
        // 长路径的显示状态 = 车辆显示状态 AND 全局长路径开关状态
        agent.graph_long_path.visible = vehicle.isShow && allLongPathsVisible.value
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
          // 短路径的显示状态 = 车辆显示状态 AND 全局短路径开关状态
          agent.graph_short_path.visible = allShortPathsVisible.value
        }
        if (agent.graph_long_path) {
          // 长路径的显示状态 = 车辆显示状态 AND 全局长路径开关状态
          agent.graph_long_path.visible = allLongPathsVisible.value
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
          // 当车辆隐藏时，路径也必须隐藏
          agent.graph_short_path.visible = false
        }
        if (agent.graph_long_path) {
          // 当车辆隐藏时，路径也必须隐藏
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

  // 显示所有短路径
  function showAllShortPaths() {
    allShortPathsVisible.value = true
    const manager = getApplicationManager()
    if (manager && manager.agents) {
      Object.values(manager.agents).forEach((agent) => {
        if (agent.graph_short_path) {
          // 只有当车辆本身显示时，才显示短路径
          agent.graph_short_path.visible = agent.graphics ? agent.graphics.visible : true
        }
      })
    }
    console.log('显示所有短路径')
  }

  // 隐藏所有短路径
  function hideAllShortPaths() {
    allShortPathsVisible.value = false
    const manager = getApplicationManager()
    if (manager && manager.agents) {
      Object.values(manager.agents).forEach((agent) => {
        if (agent.graph_short_path) {
          agent.graph_short_path.visible = false
        }
      })
    }
    console.log('隐藏所有短路径')
  }

  // 显示所有长路径
  function showAllLongPaths() {
    allLongPathsVisible.value = true
    const manager = getApplicationManager()
    if (manager && manager.agents) {
      Object.values(manager.agents).forEach((agent) => {
        if (agent.graph_long_path) {
          // 只有当车辆本身显示时，才显示长路径
          agent.graph_long_path.visible = agent.graphics ? agent.graphics.visible : true
        }
      })
    }
    console.log('显示所有长路径')
  }

  // 隐藏所有长路径
  function hideAllLongPaths() {
    allLongPathsVisible.value = false
    const manager = getApplicationManager()
    if (manager && manager.agents) {
      Object.values(manager.agents).forEach((agent) => {
        if (agent.graph_long_path) {
          agent.graph_long_path.visible = false
        }
      })
    }
    console.log('隐藏所有长路径')
  }

  return {
    // 状态
    vehicleDialogVisible,
    vehicles,
    selectedVehicle,
    allShortPathsVisible,
    allLongPathsVisible,

    // 计算属性
    vehicleCount,
    allVehiclesVisible,

    // 方法
    getApplicationManager,
    updateVehicleList,
    selectVehicle,
    handleStatusChange,
    showAllVehicles,
    hideAllVehicles,
    showAllShortPaths,
    hideAllShortPaths,
    showAllLongPaths,
    hideAllLongPaths,
    toggleVehicleDialog,
  }
})
