<template>
  <div class="agents-controls">
    <el-button type="primary" plain @click="vehicleStore.toggleVehicleDialog" size="small">
      Vehicle List
    </el-button>
    <!-- <div class="switch-container">
      <span class="switch-label">Show All</span>
      <el-switch v-model="" @change="toggleAllVehicles" size="default" />
    </div> -->

      <el-button @click="showAll" type="primary" plain size="small">show all</el-button>
      <el-button @click="hideAll" type="primary" plain size="small">hide all</el-button>

      <span class="switch-label">Short Path</span>
      <el-switch v-model="globalSettings.vehicle_allShortPathsVisible" @change="toggleAllVehicles" size="small" />
      <span class="switch-label">Long Path</span>
      <el-switch v-model="globalSettings.vehicle_allLongPathsVisible" @change="toggleAllVehicles" size="small" />
      <span class="switch-label">Id</span>
      <el-switch v-model="globalSettings.vehicle_allIDsVisible" @change="toggleAllVehicles" size="small" />
      <span class="switch-label">Stop Time</span>
      <el-switch v-model="vehicleStore.stopTimeVisible" size="small" />
      <span class="switch-label">Recycle Stop Time</span>
      <el-switch v-model="vehicleStore.reStopTimeVisible" size="small" />

    <el-divider direction="vertical" />

    <div class="switch-container">
      <span class="switch-label">self_area</span>
      <el-switch v-model="globalSettings.vehicle_selfAreaVisible" @change="toggleAllVehicles" size="small" />
    </div>

    <div class="switch-container">
      <span class="switch-label">ga_area</span>
      <el-switch v-model="globalSettings.vehicle_gaAreasVisible" @change="toggleAllVehicles" size="small" />
    </div>

    <div class="switch-container">
      <span class="switch-label">pga_area</span>
      <el-switch v-model="globalSettings.vehicle_pgaAreasVisible" @change="toggleAllVehicles" size="small" />
    </div>

    <div class="switch-container">
      <span class="switch-label">pla_area</span>
      <el-switch v-model="globalSettings.vehicle_plaAreasVisible" @change="toggleAllVehicles" size="small" />
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

// 显示所有
const showAll = () => {
  vehicleStore.showAllVehicles()
}

// 隐藏所有
const hideAll = () => {
  vehicleStore.hideAllVehicles()
}

</script>



<style scoped>
.agents-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

/* .vehicle-controls {
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
} */

.switch-label {
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  margin-right: 4px;
  flex-shrink: 0;
}
</style>
