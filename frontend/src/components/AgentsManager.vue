<template>
  <div class="vehicle-controls">
    <el-button type="primary" plain @click="globalStore.toggleVehicleDialog">
      All Vehicles
    </el-button>
    <el-button type="primary" plain @click="globalStore.showAllVehicles">show all</el-button>
    <el-button type="primary" plain @click="globalStore.hideAllVehicles">hide all</el-button>
  </div>
</template>

<script lang="ts" setup>
import { useGlobalStore } from '../stores/globalStore'

const globalStore = useGlobalStore()
</script>

<style scoped>
.vehicle-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}
</style>
