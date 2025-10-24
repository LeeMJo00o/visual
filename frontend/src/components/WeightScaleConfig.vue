<!-- 权重系数配置 -->
<template>
  <div class="lock-area-func">
    <el-button type="success" plain @click="handleOpen">Set</el-button>
  </div>
  <el-dialog
    v-model="dialogFormVisible"
    title="权重系数配置"
    width="600"
    :close-on-click-modal="false"
    :append-to-body="true"
  >
    <template #header="{ titleId }">
      <div>
        <span :id="titleId">权重系数配置</span>
        <el-icon style="margin-left: 10px; cursor: pointer" @click="handleRefresh"
          ><Refresh
        /></el-icon>
      </div>
    </template>

    <el-collapse v-model="activeNames" v-loading="dialogFormLoading">
      <el-collapse-item title="Default Weights" name="1">
        <div class="scrollable-content" style="height: 40vh; overflow-y: auto">
          <el-form :model="form" label-width="auto" size="small" :disabled="globalStore.isReplay">
            <template v-for="item in static_weight_list">
              <el-form-item :label="item.label">
                <el-input v-model="form[item.key1][item.key2]" type="number" />
              </el-form-item>
            </template>
          </el-form>
        </div>
      </el-collapse-item>
      <el-collapse-item title="Dynamic Weights" name="2">
        <el-form :model="form" label-width="auto" size="small" :disabled="globalStore.isReplay">
          <template v-for="item in dynamic_weight_list">
            <el-form-item :label="item.label">
              <el-input v-model.number="form[item.key1][item.key2]" type="number" />
            </el-form-item>
          </template>
        </el-form>
      </el-collapse-item>
      <el-collapse-item title="Scale" name="3">
        <el-form label-width="auto" size="small" :disabled="globalStore.isReplay">
          <el-form-item label="NPA_SCALE">
            <el-input v-model="NPA_SCALE" />
          </el-form-item>
          <el-form-item label="BS_CURVE_SCALE">
            <el-input v-model="BS_CURVE_SCALE" />
          </el-form-item>
          <el-form-item label="STACK_BUSY_BUSY_SCALE">
            <el-input v-model="STACK_BUSY_BUSY_SCALE" />
          </el-form-item>
          <el-form-item label="STACK_BUSY_CROWDED_SCALE">
            <el-input v-model="STACK_BUSY_CROWDED_SCALE" />
          </el-form-item>
        </el-form>
      </el-collapse-item>
    </el-collapse>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel" :disabled="submitLoading">取消</el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitLoading"
          :disabled="globalStore.isReplay"
        >
          提交
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { Refresh } from '@element-plus/icons-vue'
import { useGlobalStore } from '@/stores/globalStore'
const globalStore = useGlobalStore()

const activeNames = ref(['1'])

type WeightConfigData = {
  // static
  bypass: { 'road_type:bypass': number }
  straight: { 'is_straight:true': number }
  curve: { 'is_straight:false': number }
  service: { 'road_type:service': number }
  QC: { 'road_type:QC': number }
  qc_lanechange: { 'road_type:qc_lanechange': number }
  QC_main: { 'pptype:QC_main': number }
  block_main: { 'pptype:block_main': number }
  parking: { 'pptype:parking': number }
  charging: { 'pptype:charging': number }
  lock_station: { 'lock_station:true': number }
  QC_enter: { 'bridge_path:entrance': number }
  QC_exit: { 'bridge_path:exit': number }
  curve_small: { 'pptype:curve_small': number }
  curve_medium: { 'pptype:curve_medium': number }
  curve_big: { 'pptype:curve_big': number }
  QC_SLA: { 'road_type:QC_SLA': number }
  QC_SLA_EXIT: { 'road_type:QC_SLA_EXIT': number }
  prefer: { 'prefer:prefer': number }
  // dynamic
  STOP_VEHICLE: { 'stop_scale:': number }
  GLOBAL_SEQUENCE: { 'global_sequence:': number }
  VPB_SCALE: { 'vpb_scale:': number }
}

function createDefaultConfig(): WeightConfigData {
  return {
    bypass: { 'road_type:bypass': 0 },
    straight: { 'is_straight:true': 0 },
    curve: { 'is_straight:false': 0 },
    service: { 'road_type:service': 0 },
    QC: { 'road_type:QC': 0 },
    qc_lanechange: { 'road_type:qc_lanechange': 0 },
    QC_main: { 'pptype:QC_main': 0 },
    block_main: { 'pptype:block_main': 0 },
    parking: { 'pptype:parking': 0 },
    charging: { 'pptype:charging': 0 },
    lock_station: { 'lock_station:true': 0 },
    QC_enter: { 'bridge_path:entrance': 0 },
    QC_exit: { 'bridge_path:exit': 0 },
    curve_small: { 'pptype:curve_small': 0 },
    curve_medium: { 'pptype:curve_medium': 0 },
    curve_big: { 'pptype:curve_big': 0 },
    QC_SLA: { 'road_type:QC_SLA': 0 },
    QC_SLA_EXIT: { 'road_type:QC_SLA_EXIT': 0 },
    STOP_VEHICLE: { 'stop_scale:': 0 },
    GLOBAL_SEQUENCE: { 'global_sequence:': 0 },
    prefer: { 'prefer:prefer': 0 },
    VPB_SCALE: { 'vpb_scale:': 0 },
  }
}

// 弹窗
const dialogFormLoading = ref(false) // 加载数据
const submitLoading = ref(false) // 提交
const dialogFormVisible = ref(false) // 弹窗显示

// 权重数据
const form = ref<WeightConfigData>(createDefaultConfig())

// 其它系数
// NPA_SCALE
const NPA_SCALE = ref<number | string>('inf')

// BS_CURVE_SCALE
const BS_CURVE_SCALE = ref<number | string>(1000)

// STACK_BUSY_BUSY_SCALE
const STACK_BUSY_BUSY_SCALE = ref<number | string>(1)

// STACK_BUSY_CROWDED_SCALE
const STACK_BUSY_CROWDED_SCALE = ref<number | string>(2)

// 显示数据的标签、key1、key2
const static_weight_list = [
  { label: 'bypass', key1: 'bypass', key2: 'road_type:bypass' },
  { label: 'straight', key1: 'straight', key2: 'is_straight:true' },
  { label: 'curve', key1: 'curve', key2: 'is_straight:false' },
  { label: 'service', key1: 'service', key2: 'road_type:service' },
  { label: 'QC', key1: 'QC', key2: 'road_type:QC' },
  { label: 'QC_lanechange', key1: 'qc_lanechange', key2: 'road_type:qc_lanechange' },
  { label: 'QC_main', key1: 'QC_main', key2: 'pptype:QC_main' },
  { label: 'block_main', key1: 'block_main', key2: 'pptype:block_main' },
  { label: 'parking', key1: 'parking', key2: 'pptype:parking' },
  { label: 'charging', key1: 'charging', key2: 'pptype:charging' },
  { label: 'lock_station', key1: 'lock_station', key2: 'lock_station:true' },
  { label: 'QC_enter', key1: 'QC_enter', key2: 'bridge_path:entrance' },
  { label: 'QC_exit', key1: 'QC_exit', key2: 'bridge_path:exit' },
  { label: 'curve_small', key1: 'curve_small', key2: 'pptype:curve_small' },
  { label: 'curve_medium', key1: 'curve_medium', key2: 'pptype:curve_medium' },
  { label: 'curve_big', key1: 'curve_big', key2: 'pptype:curve_big' },
  { label: 'QC_SLA', key1: 'QC_SLA', key2: 'road_type:QC_SLA' },
  { label: 'QC_SLA_EXIT', key1: 'QC_SLA_EXIT', key2: 'road_type:QC_SLA_EXIT' },
  { label: 'prefer', key1: 'prefer', key2: 'prefer:prefer' },
]
const dynamic_weight_list = [
  { label: 'STOP_VEHICLE', key1: 'STOP_VEHICLE', key2: 'stop_scale:' },
  { label: 'GLOBAL_SEQUENCE', key1: 'GLOBAL_SEQUENCE', key2: 'global_sequence:' },
  { label: 'VPB_SCALE', key1: 'VPB_SCALE', key2: 'vpb_scale:' },
]

function convertWeightConfig(data: WeightConfigData): WeightConfigData {
  const result: Partial<WeightConfigData> = {}

  for (const [category, config] of Object.entries(data)) {
    const typedCategory = category as keyof WeightConfigData
    result[typedCategory] = {} as any

    for (const [key, value] of Object.entries(config)) {
      // 保留原始键名，仅转换值
      result[typedCategory]![key] =
        typeof value === 'string'
          ? Number(value) || 0 // 转换失败时默认0
          : value
    }
  }

  return result as WeightConfigData
}

// 弹窗取消
const handleCancel = () => {
  dialogFormVisible.value = false
}

const query = async () => {
  const response = await axios.get('/api/weight/config/query')
  console.log('query weight config response:', response)
  if (response.status === 200 && response.data.code === 200 && response.data.data) {
    let data = response.data.data
    if (data.weightConfigData) {
      form.value = data.weightConfigData
    }
    NPA_SCALE.value = data.NPA_SCALE
    BS_CURVE_SCALE.value = data.BS_CURVE_SCALE
    STACK_BUSY_BUSY_SCALE.value = data.STACK_BUSY_BUSY_SCALE
    STACK_BUSY_CROWDED_SCALE.value = data.STACK_BUSY_CROWDED_SCALE

    ElMessage({ message: '加载成功', type: 'success' })
  } else {
    ElMessage({ message: '加载失败', type: 'error' })
  }
}

const update = async () => {
  // 将value转换为number
  const data = {
    weightConfigData: convertWeightConfig(form.value),
    NPA_SCALE: NPA_SCALE.value,
    BS_CURVE_SCALE: BS_CURVE_SCALE.value,
    STACK_BUSY_BUSY_SCALE: STACK_BUSY_BUSY_SCALE.value,
    STACK_BUSY_CROWDED_SCALE: STACK_BUSY_CROWDED_SCALE.value,
  }

  const response = await axios.post('/api/weight/config/update', data, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (response.status === 200 && response.data.code === 200) {
    ElMessage({ message: '权重系数配置更新成功', type: 'success' })
    dialogFormVisible.value = false
  } else {
    ElMessage({ message: '权重系数配置更新失败', type: 'error' })
  }
}

const handleRefresh = async () => {
  if (globalStore.isReplay) {
    // ElMessage({ message: '当前为回放状态，无法刷新数据', type: 'warning' })
    return
  }
  dialogFormLoading.value = true
  try {
    await query()
  } catch (error) {
    console.log('query weight config data error: ', error)
    // 提示
    ElMessage.error('加载权重配置数据失败')
  } finally {
    dialogFormLoading.value = false
  }
}

const handleOpen = async () => {
  dialogFormVisible.value = true
  await handleRefresh()
}

// 弹窗确认
const handleSubmit = async () => {
  submitLoading.value = true

  // TODO: 发送HTTP请求
  try {
    await update()
  } catch (error) {
    console.log('update weight config data error: ', error)
    // 提示
    ElMessage.error('更新权重配置数据失败')
  } finally {
    submitLoading.value = false
  }
}

watch(
  () => globalStore.isReplay,
  (newVal) => {
    if (newVal === true) {
      if (globalStore.weightConfig?.weightConfigData) {
        form.value = globalStore.weightConfig.weightConfigData
      }
      NPA_SCALE.value = globalStore.weightConfig?.NPA_SCALE
      BS_CURVE_SCALE.value = globalStore.weightConfig?.BS_CURVE_SCALE
      STACK_BUSY_BUSY_SCALE.value = globalStore.weightConfig?.STACK_BUSY_BUSY_SCALE
      STACK_BUSY_CROWDED_SCALE.value = globalStore.weightConfig?.STACK_BUSY_CROWDED_SCALE
    } else {
      query()
    }
  },
)

// 在组件卸载时清理资源
onUnmounted(() => {
  //
})
</script>
