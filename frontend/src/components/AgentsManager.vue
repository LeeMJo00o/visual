<template>
  <div class="vehicle-controls">
    <el-button type="primary" plain @click="vehicleStore.toggleVehicleDialog">
      Vehicle List
    </el-button>
    <div class="switch-container">
      <span class="switch-label">Show All</span>
      <el-switch v-model="allVehiclesVisible" @change="toggleAllVehicles" size="default" />
    </div>
    <div class="switch-container">
      <span class="switch-label">Short Paths</span>
      <el-switch v-model="allShortPathsVisible" @change="toggleAllShortPaths" size="default" />
    </div>
    <div class="switch-container">
      <span class="switch-label">Long Paths</span>
      <el-switch v-model="allLongPathsVisible" @change="toggleAllLongPaths" size="default" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useVehicleStore } from '../stores/vehicleStore'

const vehicleStore = useVehicleStore()

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
const toggleAllVehicles = (value: boolean) => {
  if (value) {
    vehicleStore.showAllVehicles()
  } else {
    vehicleStore.hideAllVehicles()
  }
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
