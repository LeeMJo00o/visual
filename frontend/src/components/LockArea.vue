<script setup lang="ts">
import ApplicationManager from '../routing_map/main.ts'
import { ref, onMounted, onUnmounted } from 'vue'
import { useLockAreaStore } from '../stores/lockAreaStore'
import { Graphics } from 'pixi.js'
import axios from 'axios'

const appManager = ref<ApplicationManager | null>(null)
const isDrawingMode = ref(false)
const drawingStartPoint = ref<{ x: number; y: number } | null>(null)
const drawingEndPoint = ref<{ x: number; y: number } | null>(null)
const drawingGraphics = ref<any>(null)
const lockAreaStore = useLockAreaStore()

onMounted(async () => {
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

  drawingGraphics.value.rect(left, top, width, height).stroke({ color: '#ff0000', width: 2 })
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

  // 重置状态
  drawingStartPoint.value = null
  drawingEndPoint.value = null

  // 恢复默认鼠标功能
  setMouseFunction('default')
  isDrawingMode.value = false

  // 显示确认对话框
  showDrawingConfirmDialog(left, top, width, height)
}

const showDrawingConfirmDialog = (left: number, top: number, width: number, height: number) => {
  if (!appManager.value) return

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

  const verticesText = mapVertices.map((v) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}]`).join('<br>')

  // 导入Element Plus的ElMessageBox
  import('element-plus')
    .then(({ ElMessageBox }) => {
      ElMessageBox.confirm(`${verticesText}`, '画框确认', {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'success',
        dangerouslyUseHTMLString: true,
      })
        .then(() => {
          // 用户点击确认，发送HTTP请求
          sendDrawingRequest(left, top, width, height)
        })
        .catch(() => {
          // 用户点击取消，什么都不做
          console.log('用户取消了画框操作')
        })
        .finally(() => {
          // 无论用户选择什么，都清除画框
          clearCurrentDrawing()
        })
    })
    .catch((error) => {
      console.error('加载Element Plus组件失败:', error)
      // 降级处理：使用原生confirm
      const confirmed = confirm(
        `确认要处理这个区域吗？\n\n${verticesText}\n\n尺寸: ${width.toFixed(2)} x ${height.toFixed(2)}`,
      )
      if (confirmed) {
        sendDrawingRequest(left, top, width, height)
      }
      // 无论用户选择什么，都清除画框
      clearCurrentDrawing()
    })
}

const clearCurrentDrawing = () => {
  if (drawingGraphics.value) {
    drawingGraphics.value.clear()
  }
}

const sendDrawingRequest = async (left: number, top: number, width: number, height: number) => {
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

    const requestData = {
      name: 'lock_area_' + Date.now(), // 生成唯一名称
      subtype: 'lock',
      type: 'lock',
      created_by: 'pp-visual',
      describe: '',
      polygon: polygon,
    }

    console.log('发送画框请求:', requestData)

    // 发送HTTP请求到后端
    const response = await axios.post('/api/map/add_lock_area', requestData, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('画框请求成功:', response.data)

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
    <el-button type="success" plain @click="lockAreaStore.toggleLockAreaDialog"
      >Area List</el-button
    >
    <el-button type="primary" plain @click="handleDrawBox">start draw</el-button>
  </div>
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
