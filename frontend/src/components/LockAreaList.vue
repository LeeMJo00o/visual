<template>
  <!-- 锁闭区列表对话框 -->
  <CustomDialog
    v-model:visible="areaStore.lockAreaDialogVisible"
    :title="'Area List('+type+')'"
    :width="580"
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

    <div v-if="areaStore.lockAreas.length === 0" class="no-lock-areas">
      <p>暂无数据</p>
    </div>

    <el-table
      v-else
      :data="areaStore.lockAreas"
      size="small"
      stripe
      class="lock-area-table"
      @wheel="handleTableWheel"
      highlight-current-row
      @row-click="areaStore.selectLockArea"
    >
      <el-table-column prop="name" label="Name" min-width="200">
        <template #default="{ row }">
          <span class="lock-area-name">{{ row.name }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="area" label="Limit" min-width="70" v-if="type=='limit'">
        <template #default="{ row }">
          <span class="lock-area-name">{{ row.area.limit }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="area" label="Count" min-width="70" v-if="type=='limit'">
        <template #default="{ row }">
          <span class="lock-area-name">{{ row.area.count }}</span>
        </template>
      </el-table-column>

      <el-table-column label="Action" width="200" align="center">
        <template #default="{ row }">
          <el-button
            type="danger"
            plain
            size="small"
            :loading="areaStore.isLoading"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
          <el-button
            type="primary"
            plain
            size="small"
            :loading="areaStore.isLoading"
            @click="handleEdit(row)"
            v-if="type=='limit'"
          >
            编辑
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </CustomDialog>

  <!-- 编辑流量控制区域的对话框 -->
    <el-dialog v-model="editDialogVisible" 
      title="编辑流量控制值？" 
      width="500" 
      :close-on-click-modal="false"
      :append-to-body="true">
    <el-form>
      <!-- 流量控制区域控制车辆数 -->
      <el-form-item label="limit" label-width="140px" v-if="type === 'limit'">
        <el-input-number v-if="currentRow" v-model="currentRow.area.limit" :min="0" :max="1000" :precision="0"/>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="editDialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="dialogFormLoading">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeMap } from '../stores/lockAreaStore'
import CustomDialog from './CustomDialog.vue'

//编辑对话框
const currentRow = ref(null); //当前编辑的行数据
const editDialogVisible = ref(false); //编辑弹窗是否显示
const dialogFormLoading = ref(false); // loading

// area类型
const props = defineProps<{ type: string }>();

const areaStore = storeMap[props.type]?.();

if (!areaStore) {
  throw new Error(`Unknown type: ${props.type}`);
}

// 锁闭区管理相关逻辑
const lockAreaCount = computed(() => areaStore.lockAreaCount)

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
    await areaStore.deleteLockArea(row.id)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除确认对话框错误:', error)
    }
  }
}

// 处理编辑，弹窗显示修改limit值
const handleEdit = (row: any) => {
  currentRow.value = row
  editDialogVisible.value = true
}

// 确认保存
const handleConfirm = async () => {
  try{
    dialogFormLoading.value = true
    await areaStore.addOrUpdateLockArea(currentRow.value.area)
    editDialogVisible.value = false
  }catch(error){
    console.error('保存错误:', error)
  }finally{
    dialogFormLoading.value = false
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
