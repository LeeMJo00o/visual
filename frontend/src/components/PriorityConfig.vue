<!-- 优先级系数配置 -->
<template>
    <div class="lock-area-func">
        <el-button type="success" plain @click="handleOpen">Set</el-button>

        <span style="margin-left: 20px;">Visible: <el-switch v-model="priorityStore.visible"></el-switch></span>
    </div>
    <el-dialog v-model="dialogFormVisible" title="优先级系数配置" width="600" :close-on-click-modal="false" :append-to-body="true">

        <template #header="{ titleId }">
            <div>
                <span :id="titleId">优先级系数配置</span>
                <el-icon style="margin-left: 10px; cursor: pointer;" @click="handleRefresh"><Refresh /></el-icon>
            </div>
        </template>

        <div class="scrollable-content" style="height: 40vh; overflow-y: auto" v-loading="dialogFormLoading">
            <el-form :model="form" label-width="auto" size="small">
                <el-form-item label="isOpenPriority">
                    <el-switch v-model="form.isOpenPriority" />
                </el-form-item>
                <el-form-item label="hasStopLinePriority">
                    <el-input v-model="form.hasStopLinePriority" type="number" />
                </el-form-item>
                <el-form-item label="notStopLinePriority">
                    <el-input v-model="form.notStopLinePriority" type="number" />
                </el-form-item>
                <el-form-item label="hasTurnRoadPriority">
                    <el-input v-model="form.hasTurnRoadPriority" type="number" />
                </el-form-item>
                <el-form-item label="notTurnRoadPriority">
                    <el-input v-model="form.notTurnRoadPriority" type="number" />
                </el-form-item>
                <el-form-item label="parkPriority">
                    <el-input v-model="form.parkPriority" type="number" />
                </el-form-item>
                <el-form-item label="parkTimeLimit">
                    <el-input v-model="form.parkTimeLimit" type="number" />
                </el-form-item>
            </el-form>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <el-button @click="handleCancel" :disabled="submitLoading">取消</el-button>
                <el-button type="primary" @click="handleSubmit" :loading="submitLoading">
                    提交
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>


<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios';
import { Refresh } from '@element-plus/icons-vue'
import { usePriorityStore } from '@/stores/priority';


const activeNames = ref(['1'])

const priorityStore = usePriorityStore()

type PriorityConfigData = {
    hasStopLinePriority: number;
    notStopLinePriority: number;
    hasTurnRoadPriority: number;
    notTurnRoadPriority: number;
    parkPriority: number;
    parkTimeLimit: number;
    isOpenPriority: boolean;
}

function createDefaultConfig(): PriorityConfigData {
    return {
        hasStopLinePriority: 10,
        notStopLinePriority: 20,
        hasTurnRoadPriority: 5,
        notTurnRoadPriority: 20,
        parkPriority: 1,
        parkTimeLimit: 10,
        isOpenPriority: true,
    };
}


// 弹窗
const dialogFormLoading = ref(false)    // 加载数据
const submitLoading = ref(false)        // 提交
const dialogFormVisible = ref(false)    // 弹窗显示

// 权重数据
const form = ref<PriorityConfigData>(createDefaultConfig())


function convert(data: PriorityConfigData): PriorityConfigData {
  return {
    hasStopLinePriority: Number(data.hasStopLinePriority),
    notStopLinePriority: Number(data.notStopLinePriority),
    hasTurnRoadPriority: Number(data.hasTurnRoadPriority),
    notTurnRoadPriority: Number(data.notTurnRoadPriority),
    parkPriority: Number(data.parkPriority),
    parkTimeLimit: Number(data.parkTimeLimit),
    isOpenPriority:  String(data.isOpenPriority) === 'true',
  }
}

// 弹窗取消
const handleCancel = () => {
    dialogFormVisible.value = false
}

const query = async () => {
    const response = await axios.get('/api/priority/config/query')
    console.log("query priority config response:", response)
    if (response.status === 200 && response.data.code === 200 && response.data.data) {
        let data = response.data.data
        form.value = data
        ElMessage({ message: '加载成功', type: 'success' })
    }else{
        ElMessage({ message: '加载失败', type: 'error' })
    }
}

const update = async () => {
    // 将value转换为number
    const data = convert(form.value)

    const response = await axios.post(
        '/api/priority/config/update',
        data,
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    )
    if(response.status === 200 && response.data.code === 200) {
        ElMessage({ message: '优先级配置更新成功', type: 'success' })
        dialogFormVisible.value = false
    } else {
        ElMessage({ message: '优先级配置更新失败', type: 'error' })
    }
}

const handleRefresh = async () => {
    dialogFormLoading.value = true
    try {
        await query()
    } catch (error) {
        console.log("query weight config data error: ", error)
        // 提示
        ElMessage.error('加载优先级配置数据失败')
    } finally {
        dialogFormLoading.value = false
    }
}

const handleOpen = async () => {
    dialogFormVisible.value = true
    handleRefresh()
}

// 弹窗确认
const handleSubmit = async () => {
    submitLoading.value = true

    // TODO: 发送HTTP请求
    try {
        await update()
    } catch (error) {
        console.log("update priority config data error: ", error)
        // 提示
        ElMessage.error('更新优先级配置数据失败')
    } finally {
        submitLoading.value = false
    }
}



// 在组件卸载时清理资源
onUnmounted(() => {
    //
})
</script>
