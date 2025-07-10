<template>
  <!-- 锁闭区列表对话框 -->
  <CustomDialog
    v-model:visible="lockAreaStore.lockAreaDialogVisible"
    title="Lock Area List"
    :width="500"
    :height="400"
    :min-width="400"
    :min-height="300"
    :max-width="800"
    :max-height="600"
    :draggable="true"
    :resizable="true"
  >
    <div class="lock-area-list-header">
      <h4>Lock Areas ({{ ` ${lockAreaCount} ` }})</h4>
    </div>

    <div v-if="lockAreaStore.lockAreas.length === 0" class="no-lock-areas">
      <p>暂无锁闭区信息</p>
    </div>

    <el-table
      v-else
      :data="lockAreaStore.lockAreas"
      size="small"
      stripe
      class="lock-area-table"
      @wheel="handleTableWheel"
    >
      <el-table-column prop="name" label="Name" min-width="200">
        <template #default="{ row }">
          <span class="lock-area-name">{{ row.name }}</span>
        </template>
      </el-table-column>

      <el-table-column label="Action" width="120" align="center">
        <template #default="{ row }">
          <el-button
            type="danger"
            plain
            size="small"
            :loading="lockAreaStore.isLoading"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </CustomDialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useLockAreaStore } from '../stores/lockAreaStore'
import CustomDialog from './CustomDialog.vue'

const lockAreaStore = useLockAreaStore()

// 锁闭区管理相关逻辑
const lockAreaCount = computed(() => lockAreaStore.lockAreaCount)

// 处理表格滚轮事件
const handleTableWheel = (e: WheelEvent) => {
  // 阻止事件冒泡，让表格自己处理滚动
  e.stopPropagation()
}

// 处理删除操作
const handleDelete = async (row: any) => {
  try {
    // 显示确认对话框
    const { ElMessageBox } = await import('element-plus')
    await ElMessageBox.confirm(`确定要删除锁闭区 "${row.name}" 吗？`, '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    // 用户确认删除
    await lockAreaStore.deleteLockArea(row.id)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除确认对话框错误:', error)
    }
  }
}
</script>

<style scoped>
/* 必要的功能样式 */
.no-lock-areas {
  text-align: center;
  padding: 40px;
  color: #909399;
  background: #f8f9fa;
  border-radius: 6px;
}

.lock-area-name {
  font-weight: 500;
  color: #303133;
}

/* 表格高度控制 */
:deep(.lock-area-table) {
  height: 100%;
}

:deep(.lock-area-table .el-table__body-wrapper) {
  height: calc(100% - 40px);
  overflow-y: auto;
  overflow-x: hidden;
}

.lock-area-list-header {
  margin-bottom: 16px;
}

.lock-area-list-header h4 {
  margin: 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}
</style>
