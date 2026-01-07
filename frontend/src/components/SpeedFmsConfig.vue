<!-- speed fms配置 -->
<template>
  <div class="lock-area-func">
    <el-button type="success" plain @click="handleOpen">Show</el-button>
  </div>

  <CustomDialog
    v-model:visible="dialogFormVisible"
    title="FMS速度配置"
    :width="300"
    :height="300"
    :min-width="400"
    :min-height="100"
    :max-width="1200"
    :max-height="800"
    :draggable="true"
    :resizable="true"
  >
    <div class="scrollable-content" v-loading="dialogFormLoading">
      <el-form :model="form" label-width="auto" size="small" v-if="form">
        <el-form-item label="直线">
          <el-input v-model="form.line" readonly />
        </el-form-item>
        <el-form-item label="弯道">
          <el-input v-model="form.turn" type="number" readonly />
        </el-form-item>
        <el-form-item label="变道">
          <el-input v-model="form.laneChange" type="number" readonly />
        </el-form-item>
      </el-form>
      <span v-else> 没有数据 </span>
    </div>
  </CustomDialog>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import CustomDialog from './CustomDialog.vue'
import { useGlobalStore } from '@/stores/globalStore'

type PriorityConfigData = {
  line: number
  turn: number
  laneChange: number
  operationSwitch: number
}

const globalStore = useGlobalStore()

watch(
  () => globalStore.speedConfig,
  (newVal) => {
    if (newVal) {
      form.value = newVal
    }
  },
)
// 弹窗
const dialogFormLoading = ref(false) // 加载数据
const dialogFormVisible = ref(false) // 弹窗显示

// 权重数据
const form = ref<PriorityConfigData | null>(null)

const query = async () => {
  const response = await axios.get('/api/speed/config/query')
  console.log('query speed config response:', response)
  //   如果处于回放状态，则需要忽略此次数据
  if (globalStore.isReplay) {
    return
  }
  if (response.status === 200 && response.data.code === 200 && response.data.data) {
    let data = response.data.data
    form.value = data
    ElMessage({ message: '加载成功', type: 'success' })
  } else {
    form.value = null
    ElMessage({ message: '加载失败', type: 'error' })
  }
}

const handleRefresh = async () => {
  dialogFormLoading.value = true
  try {
    await query()
  } catch (error) {
    console.log('query speed config data error: ', error)
    // 提示
    ElMessage.error('加载FMS速度配置数据失败')
  } finally {
    dialogFormLoading.value = false
  }
}

const handleOpen = async () => {
  dialogFormVisible.value = true
  handleRefresh()
}

// 在组件卸载时清理资源
onUnmounted(() => {
  //
})
</script>
