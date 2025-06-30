<template>
  <el-button plain @click="dialogVisible = true"> Open Custom Dialog </el-button>

  <CustomDialog
    v-model:visible="dialogVisible"
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
    <div class="dialog-content vehicle-table-container">
        <h4>Vehicles ({{ ` ${vehicleCount} ` }})</h4>
        <div v-if="vehicles.length === 0" class="no-vehicles">
          <p>暂无车辆信息</p>
        </div>
        <el-table
          v-else
          :data="vehicles"
          size="small"
          stripe
          class="vehicle-table"
          @row-click="selectVehicle"
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
              <el-switch
                v-model="row.isShow"
                size="small"
                :active-text="'显示'"
                :inactive-text="'隐藏'"
                @change="handleStatusChange(row)"
              />
            </template>
          </el-table-column>

          <!-- <el-table-column label="角度" width="80" align="center">
            <template #default="{ row }">
              <span>{{ row.position.theta.toFixed(1) }}°</span>
            </template>
          </el-table-column> -->

          <!-- <el-table-column label="颜色" width="60" align="center">
            <template #default="{ row }">
              <div class="color-indicator" :style="{ backgroundColor: row.color }"></div>
            </template>
          </el-table-column> -->
        </el-table>

      <!-- <div v-if="selectedVehicle" class="selected-vehicle-details">
        <h4>选中车辆详情</h4>
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="车辆ID">{{
            selectedVehicle?.vehicle_id
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="selectedVehicle?.isAnimating ? 'success' : 'info'" size="small">
              {{ selectedVehicle?.isAnimating ? '移动中' : '静止' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="当前位置">
            X: {{ selectedVehicle?.position.x.toFixed(4) }}, Y:
            {{ selectedVehicle?.position.y.toFixed(4) }}
          </el-descriptions-item>
          <el-descriptions-item label="当前角度"
            >{{ selectedVehicle?.position.theta.toFixed(4) }}°</el-descriptions-item
          >
          <el-descriptions-item label="目标位置">
            X: {{ selectedVehicle?.targetPosition.x.toFixed(4) }}, Y:
            {{ selectedVehicle?.targetPosition.y.toFixed(4) }}
          </el-descriptions-item>
          <el-descriptions-item label="目标角度"
            >{{ selectedVehicle?.targetPosition.theta.toFixed(4) }}°</el-descriptions-item
          >
          <el-descriptions-item label="车辆颜色">
            <div class="color-preview" :style="{ backgroundColor: selectedVehicle?.color }"></div>
            {{ selectedVehicle?.color }}
          </el-descriptions-item>
        </el-descriptions>
      </div> -->
    </div>
  </CustomDialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CustomDialog from './CustomDialog.vue'

// 定义车辆接口
interface Vehicle {
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

// 定义ApplicationManager接口
interface ApplicationManager {
  agents: Record<
    string,
    {
      vehicle_id: string
      position: { x: number; y: number; theta: number }
      targetPosition: { x: number; y: number; theta: number }
      isAnimating: boolean
      color: string
      graphics?: { visible: boolean }
      graph_short_path?: { visible: boolean }
      graph_long_path?: { visible: boolean }
      text?: { visible: boolean }
    }
  >
}

const dialogVisible = ref(false)
const vehicles = ref<Vehicle[]>([])
const selectedVehicle = ref<Vehicle | null>(null)

// 获取ApplicationManager实例
const getApplicationManager = (): ApplicationManager | null => {
  return (
    (window as Window & { __applicationManagerInstance?: ApplicationManager })
      .__applicationManagerInstance || null
  )
}

// 更新车辆列表
const updateVehicleList = () => {
  const manager = getApplicationManager()
  if (manager && manager.agents) {
    vehicles.value = Object.values(manager.agents).map((agent) => {
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
  }
}

// 选择车辆
const selectVehicle = (vehicle: Vehicle) => {
  selectedVehicle.value = vehicle
}

// 处理状态变化
const handleStatusChange = (vehicle: Vehicle) => {
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

// 计算车辆数量
const vehicleCount = computed(() => vehicles.value.length)

// 定时更新车辆列表
let updateInterval: number | null = null

onMounted(() => {
  // 立即更新一次
  updateVehicleList()

  // 每秒更新一次车辆列表
  updateInterval = setInterval(updateVehicleList, 1000)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped>
.dialog-content {
  padding: 10px;
}

.vehicle-table-container {
  margin-bottom: 20px;
}

.vehicle-table-container h4 {
  margin-bottom: 15px;
  color: #409eff;
  font-size: 16px;
}

.no-vehicles {
  text-align: center;
  padding: 40px;
  color: #909399;
  background: #f8f9fa;
  border-radius: 6px;
}

.vehicle-table {
  max-height: 300px;
  overflow-y: auto;
}

.vehicle-id {
  font-weight: 600;
  color: #303133;
  font-size: 13px;
}

.reserved {
  color: #909399;
  font-style: italic;
}

.position-info {
  font-size: 12px;
  line-height: 1.2;
}

.position-info div {
  margin-bottom: 2px;
}

.color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid #dcdfe6;
  margin: 0 auto;
}

.selected-vehicle-details {
  border-top: 1px solid #e4e7ed;
  padding-top: 15px;
  margin-top: 15px;
}

.selected-vehicle-details h4 {
  margin-bottom: 12px;
  color: #409eff;
  font-size: 14px;
}

.color-preview {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 6px;
  border: 1px solid #dcdfe6;
  vertical-align: middle;
}

/* 表格行悬停效果 */
:deep(.el-table__row:hover) {
  background-color: #f0f9ff !important;
}

/* 紧凑的表格样式 */
:deep(.el-table--small) {
  font-size: 12px;
}

:deep(.el-table--small .el-table__cell) {
  padding: 4px 0;
}

:deep(.el-table--small .el-table__header .el-table__cell) {
  padding: 6px 0;
  font-weight: 600;
}

/* 开关组件样式调整 */
:deep(.el-switch--small) {
  height: 20px;
  line-height: 20px;
}

:deep(.el-switch--small .el-switch__core) {
  height: 16px;
  width: 32px;
}

:deep(.el-switch--small .el-switch__label) {
  font-size: 10px;
  line-height: 20px;
}
</style>
