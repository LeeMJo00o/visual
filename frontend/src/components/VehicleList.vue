<template>
  <!-- 车辆列表对话框 -->
  <CustomDialog
    v-model:visible="globalStore.vehicleDialogVisible"
    title="Vehicle List"
    :width="600"
    :height="400"
    :min-width="400"
    :min-height="300"
    :max-width="1200"
    :max-height="800"
    :draggable="true"
    :resizable="true"
  >
    <div class="vehicle-list-header">
      <h4>Vehicles ({{ ` ${vehicleCount} ` }})</h4>
    </div>

    <div v-if="globalStore.vehicles.length === 0" class="no-vehicles">
      <p>暂无车辆信息</p>
    </div>

    <el-table
      v-else
      :data="globalStore.vehicles"
      size="small"
      stripe
      class="vehicle-table"
      @row-click="globalStore.selectVehicle"
      @wheel="handleTableWheel"
    >
      <el-table-column prop="vehicle_id" label="Id" width="80" align="center">
        <template #default="{ row }">
          <span class="vehicle-id">{{ row.vehicle_id }}</span>
        </template>
      </el-table-column>

      <el-table-column label="Reserved" width="100" align="center">
        <template #default>
          <span class="reserved">-</span>
        </template>
      </el-table-column>

      <el-table-column label="Pose" min-width="120">
        <template #default="{ row }">
          <div class="position-info">
            <span>{{ row.position.x.toFixed(2) }}, {{ row.position.y.toFixed(2) }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="显示" width="120" align="center">
        <template #default="{ row }">
          <div class="switch-container">
            <el-switch
              v-model="row.isShow"
              size="small"
              @change="globalStore.handleStatusChange(row)"
            />
            <span class="switch-text">{{ row.isShow ? '显示' : '隐藏' }}</span>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </CustomDialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useGlobalStore } from '../stores/globalStore'
import CustomDialog from './CustomDialog.vue'

const globalStore = useGlobalStore()

// 车辆管理相关逻辑
const vehicleCount = computed(() => globalStore.vehicles.length)

// 处理表格滚轮事件
const handleTableWheel = (e: WheelEvent) => {
  // 阻止事件冒泡，让表格自己处理滚动
  e.stopPropagation()
}

// 定时更新车辆列表
let updateInterval: number | null = null

onMounted(() => {
  // 立即更新一次
  globalStore.updateVehicleList()

  // 每秒更新一次车辆列表
  updateInterval = setInterval(globalStore.updateVehicleList, 1000)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped>
/* 必要的功能样式 */
.no-vehicles {
  text-align: center;
  padding: 40px;
  color: #909399;
  background: #f8f9fa;
  border-radius: 6px;
}

.switch-container {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

/* 表格高度控制 */
:deep(.vehicle-table) {
  height: 100%;
}

:deep(.vehicle-table .el-table__body-wrapper) {
  height: calc(100% - 40px);
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
