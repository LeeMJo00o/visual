<script setup lang="ts">
import ApplicationManager from '../routing_map/main.ts'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { storeMap } from '../stores/lockAreaStore'
import { Graphics } from 'pixi.js'
import { getFillColor, getBorderColor } from '@/colors/lockarea_color.ts'

import { useGlobalStore } from '@/stores/globalStore.ts'

// area类型
const props = defineProps<{ type: string; text: string }>()

const appManager = ref<ApplicationManager | null>(null)
const isDrawingMode = ref(false)
const drawingStartPoint = ref<{ x: number; y: number } | null>(null)
const drawingEndPoint = ref<{ x: number; y: number } | null>(null)
const drawingGraphics = ref<any>(null)

const globalStore = useGlobalStore()
const areaStore = storeMap[props.type]?.();

if (!areaStore) {
  throw new Error(`Unknown type: ${props.type}`);
}

// 弹窗
const dialogFormLoading = ref(false)
const dialogFormVisible = ref(false)
const verticesText = ref('') // 坐标
const rect = ref({ left: 0, top: 0, width: 0, height: 0 })
const limit_num = ref(5) // 流量限制区域数量
const lockAreaType = ref('lock') // 锁闭区类型，默认为"锁闭区"
const lockAreaName = ref('TZ_')

const fillColor = getFillColor(props.type)
const borderColor = getBorderColor(props.type)

console.log(props.type, fillColor, borderColor)

onMounted(async () => {
  if(props.type === 'trigger') {
   lockAreaType.value = 'trigger'
  }

  appManager.value = ApplicationManager.getInstance()
  await setupDrawingGraphics()

  // 注册画框处理器到ApplicationManager
  if (appManager.value) {
    appManager.value.setDrawingHandlers({
      handleDrawingMouseDown,
      handleDrawingMouseMove,
      handleDrawingMouseUp,
    })
  }
})

onUnmounted(() => {
  cleanupDrawing()
})

const setupDrawingGraphics = async () => {
  if (!appManager.value) return

  // 创建绘制图形对象
  drawingGraphics.value = new Graphics()
  appManager.value.app.stage.addChild(drawingGraphics.value)
}

const cleanupDrawing = () => {
  if (drawingGraphics.value && appManager.value) {
    appManager.value.app.stage.removeChild(drawingGraphics.value)
    drawingGraphics.value = null
  }
}

const handleDrawBox = () => {
  if (!appManager.value) return

  console.log('画框功能已激活')
  isDrawingMode.value = true
  setMouseFunction('draw')
}

const setMouseFunction = (func: string) => {
  if (!appManager.value) return

  // 设置ApplicationManager的鼠标功能模式
  appManager.value.mouse_func = func

  if (func === 'draw') {
    // 设置鼠标为十字光标
    if (appManager.value.app && appManager.value.app.canvas) {
      appManager.value.app.canvas.style.cursor = 'crosshair'
    }
    // 禁用mainContainer的交互
    if (appManager.value.mainContainer) {
      appManager.value.mainContainer.interactive = false
      appManager.value.mainContainer.eventMode = 'none'
    }
    console.log('进入画框模式')
  } else {
    // 恢复默认光标
    if (appManager.value.app && appManager.value.app.canvas) {
      appManager.value.app.canvas.style.cursor = 'default'
    }
    // 恢复mainContainer的交互
    if (appManager.value.mainContainer) {
      appManager.value.mainContainer.interactive = true
      appManager.value.mainContainer.eventMode = 'static'
    }
    console.log('退出画框模式')
  }
}

const handleDrawingMouseDown = (e: any) => {
  if (!isDrawingMode.value || !appManager.value) return

  const point = e.global
  drawingStartPoint.value = { x: point.x, y: point.y }

  console.log('开始画框:', drawingStartPoint.value)
  if (drawingGraphics.value) {
    drawingGraphics.value.clear()
  }
}

const handleDrawingMouseMove = (e: any) => {
  if (
    !isDrawingMode.value ||
    !drawingStartPoint.value ||
    !drawingGraphics.value ||
    !appManager.value
  )
    return

  const point = e.global
  drawingEndPoint.value = { x: point.x, y: point.y }

  // 清除之前的绘制
  drawingGraphics.value.clear()

  // 计算矩形的实际位置和尺寸，支持任意方向拖动
  const left = Math.min(drawingStartPoint.value.x, drawingEndPoint.value.x)
  const top = Math.min(drawingStartPoint.value.y, drawingEndPoint.value.y)
  const width = Math.abs(drawingEndPoint.value.x - drawingStartPoint.value.x)
  const height = Math.abs(drawingEndPoint.value.y - drawingStartPoint.value.y)

  drawingGraphics.value
    .rect(left, top, width, height)
    .fill({ color: fillColor, alpha: 0.1 })
    .stroke({ color: borderColor, width: 2 })
}

const handleDrawingMouseUp = (e: any) => {
  if (
    !isDrawingMode.value ||
    !drawingStartPoint.value ||
    !drawingGraphics.value ||
    !appManager.value
  )
    return

  const point = e.global
  drawingEndPoint.value = { x: point.x, y: point.y }

  // 完成画框
  console.log('完成画框:', drawingStartPoint.value, drawingEndPoint.value)

  // 计算矩形的实际位置和尺寸
  const left = Math.min(drawingStartPoint.value.x, drawingEndPoint.value.x)
  const top = Math.min(drawingStartPoint.value.y, drawingEndPoint.value.y)
  const width = Math.abs(drawingEndPoint.value.x - drawingStartPoint.value.x)
  const height = Math.abs(drawingEndPoint.value.y - drawingStartPoint.value.y)

  rect.value = { left, top, width, height }

  // 计算四个顶点的屏幕坐标
  const screenVertices = [
    { x: left, y: top }, // 左上角
    { x: left + width, y: top }, // 右上角
    { x: left + width, y: top + height }, // 右下角
    { x: left, y: top + height }, // 左下角
  ]

  // 转换为地图坐标用于显示
  const mapVertices = screenVertices.map((vertex) => {
    const [mapX, mapY] = appManager.value!.raw_xy(vertex.x, vertex.y)
    return { x: mapX, y: mapY }
  })
  verticesText.value = mapVertices.map((v) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}]`).join('\n')

  // 重置状态
  drawingStartPoint.value = null
  drawingEndPoint.value = null

  // 恢复默认鼠标功能
  setMouseFunction('default')
  isDrawingMode.value = false

  // 显示确认对话框
  // showDrawingConfirmDialog(left, top, width, height)
  dialogFormVisible.value = true
}

// 弹窗取消
const handleCancel = () => {
  // 清除画框
  clearCurrentDrawing()
  dialogFormVisible.value = false
}

// 弹窗确认
const handleConfirm = () => {
  dialogFormLoading.value = true
  sendDrawingRequest(
    rect.value?.left,
    rect.value?.top,
    rect.value?.width,
    rect.value?.height,
    limit_num.value,
  )
  // 清除画框
  clearCurrentDrawing()
  dialogFormLoading.value = false
  dialogFormVisible.value = false
}

const clearCurrentDrawing = () => {
  if (drawingGraphics.value) {
    drawingGraphics.value.clear()
  }
}

const sendDrawingRequest = async (
  left: number,
  top: number,
  width: number,
  height: number,
  limit_num: number = 0,
) => {
  if (!appManager.value) return

  try {
    // 计算四个顶点的屏幕坐标
    const screenVertices = [
      { x: left, y: top }, // 左上角
      { x: left + width, y: top }, // 右上角
      { x: left + width, y: top + height }, // 右下角
      { x: left, y: top + height }, // 左下角
    ]

    // 转换为地图坐标
    const mapVertices = screenVertices.map((vertex) => {
      const [mapX, mapY] = appManager.value!.raw_xy(vertex.x, vertex.y)
      return { x: mapX, y: mapY }
    })

    // 创建闭合多边形（添加第一个点作为最后一个点）
    const polygon = [...mapVertices, mapVertices[0]]
    let name = ''
    let _subtype = lockAreaType.value  ? lockAreaType.value : props.type   // 有则使用lockAreaType 否则使用type作为subtype
    if (props.type === 'trigger') {
      name = lockAreaName.value
    }else {
      name = props.type === 'lock' && lockAreaType.value === 'no_parking'
          ? 'no_parking_' + Date.now()
          : _subtype + '_area_' + Date.now() // 禁停区使用no_parking_xxxx格式
    }
    let _type = props.type === 'lock' ? lockAreaType.value : props.type
    // 如果是uniform_region, 那么type仍使用lock
    if(lockAreaType.value === 'uniform_region') {
      _type = 'lock'
    }
    const requestData = {
      name: name,
      subtype:
        props.type === 'lock' && lockAreaType.value === 'no_parking' ? 'no_parking' : _subtype, // 禁停区的subtype使用no_parking
      type: _type, // 根据锁闭区类型设置正确的type
      created_by: 'pp-visual',
      describe: '',
      polygon: polygon,
      limit: limit_num,
    }

    console.log('发送画框请求:', requestData)

    // 发送HTTP请求到后端
    await areaStore.addOrUpdateLockArea(requestData)

    // 导入Element Plus的ElMessage显示成功消息
    const { ElMessage } = await import('element-plus')
    ElMessage.success('画框处理成功')
  } catch (error) {
    console.error('画框请求失败:', error)

    // 显示错误消息
    try {
      const { ElMessage } = await import('element-plus')
      ElMessage.error('画框处理失败: ' + (error.response?.data?.message || error.message))
    } catch (importError) {
      console.error('无法加载Element Plus消息组件:', importError)
      alert('画框处理失败: ' + (error.response?.data?.message || error.message))
    }
  }
}

// 在组件卸载时清理资源
onUnmounted(() => {
  cleanupDrawing()
})
</script>

<template>
  <div class="lock-area-func">
    <span>{{ text }}</span>
    <el-button type="success" plain @click="areaStore.toggleLockAreaDialog">Area List</el-button>
    <el-button type="primary" plain @click="handleDrawBox" :disabled="globalStore.isReplay">start draw</el-button>
  </div>
  <el-dialog v-model="dialogFormVisible" title="确认绘制区域？" width="550"
    :close-on-click-modal="false"
    :append-to-body="true"
    @close="handleCancel">
    <el-form>
      <!-- 多边形顶点坐标 -->
      <el-form-item label="Polygon" label-width="140px">
        <el-input v-model="verticesText" type="textarea" :rows="6" readonly autocomplete="off" />
      </el-form-item>
      <!-- 流量控制区域控制车辆数 -->
      <el-form-item label="limit" label-width="140px" v-if="type === 'limit'">
        <el-input-number v-model="limit_num" :min="0" :max="1000" :precision="0" />
      </el-form-item>
      <!-- 锁闭区类型 -->
      <el-form-item label="Area type" label-width="140px" v-if="type === 'lock'">
        <el-select v-model="lockAreaType" placeholder="请选择锁闭区类型">
          <el-option label="禁行区" value="lock" />
          <el-option label="禁停区" value="no_parking" />
          <el-option label="均匀分布区" value="uniform_region" />
        </el-select>
      </el-form-item>
      <template v-if="type === 'trigger'">
        <el-form-item label="area_type" label-width="140px" required>
          <el-input readonly v-model="lockAreaType">trigger</el-input>
        </el-form-item>
        <el-form-item label="name" label-width="140px" required>
          <el-input v-model="lockAreaName"></el-input>
          <el-alert size="small" :closable="false"  title="eg: TZ_I01_ENTRY, TZ_I01_MIDDLE, TZ_I01_EXIT" type="primary" />
        </el-form-item>
      </template>

    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="dialogFormLoading">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.lock-area-func {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
</style>
