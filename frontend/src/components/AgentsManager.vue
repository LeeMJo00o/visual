<template>
  <div class="vehicle-controls">
    <el-button type="success" plain @click="vehicleStore.toggleVehicleDialog">
      Vehicle List
    </el-button>
    <!-- <div class="switch-container">
      <span class="switch-label">Show All</span>
      <el-switch v-model="" @change="toggleAllVehicles" size="default" />
    </div> -->
    <div class="switch-container">
      <span class="switch-label">Short Paths</span>
      <el-switch v-model="globalSettings.vehicle_allShortPathsVisible" @change="toggleAllVehicles" size="default" />
    </div>
    <div class="switch-container">
      <span class="switch-label">Long Paths</span>
      <el-switch v-model="globalSettings.vehicle_allLongPathsVisible" @change="toggleAllVehicles" size="default" />
    </div>
    <div class="switch-container">
      <span class="switch-label">Vehicle IDs</span>
      <el-switch v-model="globalSettings.vehicle_allIDsVisible" @change="toggleAllVehicles" size="default" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useVehicleStore } from '../stores/vehicleStore'
import { storeToRefs } from 'pinia'
import { useGlobalSettingsStore } from '@/stores/useLocalStorage'

const settingsStore = useGlobalSettingsStore()

// 获取响应式的 settings（需要使用 storeToRefs 保持响应性）
const { globalSettings } = storeToRefs(settingsStore)

const vehicleStore = useVehicleStore()

// 车辆号码显示状态
const allVehicleIdsVisible = ref(true)

// 计算所有车辆是否都可见
const allVehiclesVisible = computed({
  get: () => vehicleStore.allVehiclesVisible,
  set: () => {
    // 这个 setter 不会被直接调用，因为我们使用 @change 事件
  },
})

// 计算所有短路径是否都可见
const allShortPathsVisible = computed({
  get: () => vehicleStore.allShortPathsVisible,
  set: () => {
    // 这个 setter 不会被直接调用，因为我们使用 @change 事件
  },
})

// 计算所有长路径是否都可见
const allLongPathsVisible = computed({
  get: () => vehicleStore.allLongPathsVisible,
  set: () => {
    // 这个 setter 不会被直接调用，因为我们使用 @change 事件
  },
})

// 切换所有车辆的显示状态
const toggleAllVehicles = () => {
  // if (value) {
  //   vehicleStore.showAllVehicles()
  // } else {
  //   vehicleStore.hideAllVehicles()
  // }
  vehicleStore.updateAllVehiclesVisible()
}

// 切换所有短路径的显示状态
const toggleAllShortPaths = (value: boolean) => {
  if (value) {
    vehicleStore.showAllShortPaths()
  } else {
    vehicleStore.hideAllShortPaths()
  }
}

// 切换所有长路径的显示状态
const toggleAllLongPaths = (value: boolean) => {
  if (value) {
    vehicleStore.showAllLongPaths()
  } else {
    vehicleStore.hideAllLongPaths()
  }
}

// 切换所有车辆号码的显示状态
const toggleAllVehicleIds = (value: boolean) => {
  const manager = vehicleStore.getApplicationManager()
  if (manager && manager.agentTextContainer) {
    manager.agentTextContainer.visible = value
    console.log(`车辆号码 ${value ? '显示' : '隐藏'}`)
  }
}
</script>

<style scoped>
.vehicle-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.switch-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-label {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
}
</style>
