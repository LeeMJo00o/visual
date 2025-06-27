<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="visible"
        ref="dialogRef"
        class="custom-dialog"
        :style="dialogStyle"
        @mousedown="handleDialogMouseDown"
      >
        <!-- 标题栏 -->
        <div class="dialog-header" @mousedown="startDrag">
          <h3 class="dialog-title">{{ title }}</h3>
          <button class="close-btn" @click="$emit('update:visible', false)">
            <span>×</span>
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="dialog-body" @wheel="handleWheel">
          <slot></slot>
        </div>

        <!-- 左侧调整尺寸手柄 -->
        <div
          class="resize-handle resize-handle-left"
          @mousedown="startResize('left', $event)"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        ></div>

        <!-- 右侧调整尺寸手柄 -->
        <div
          class="resize-handle resize-handle-right"
          @mousedown="startResize('right', $event)"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        ></div>

        <!-- 底部调整尺寸手柄 -->
        <div
          class="resize-handle resize-handle-bottom"
          @mousedown="startResize('bottom', $event)"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        ></div>

        <!-- 右下角调整尺寸手柄 -->
        <div
          class="resize-handle resize-handle-corner"
          @mousedown="startResize('corner', $event)"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        ></div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  visible: boolean
  title?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  draggable?: boolean
  resizable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Dialog',
  width: 600,
  height: 400,
  minWidth: 300,
  minHeight: 200,
  maxWidth: 1200,
  maxHeight: 800,
  draggable: true,
  resizable: true,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

// 响应式状态
const dialogRef = ref<HTMLElement>()
const dialogWidth = ref(props.width)
const dialogHeight = ref(props.height)
const dialogLeft = ref(0)
const dialogTop = ref(0)

// 拖拽状态
const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | 'bottom' | 'corner'>('right')
const startX = ref(0)
const startY = ref(0)
const startLeft = ref(0)
const startTop = ref(0)
const startWidth = ref(0)
const startHeight = ref(0)

// 计算样式
const dialogStyle = computed(() => ({
  width: `${dialogWidth.value}px`,
  height: `${dialogHeight.value}px`,
  left: `${dialogLeft.value}px`,
  top: `${dialogTop.value}px`,
}))

// 鼠标事件处理
const handleMouseEnter = () => {
  if (isResizing.value) return
  document.body.style.cursor = 'ew-resize'
}

const handleMouseLeave = () => {
  if (!isResizing.value && !isDragging.value) {
    document.body.style.cursor = 'default'
  }
}

const handleWheel = (e: WheelEvent) => {
  // 确保滚轮事件不被阻止，让内容正常滚动
  e.stopPropagation()
}

const handleDialogMouseDown = () => {
  // 确保对话框在最前面
  if (dialogRef.value) {
    dialogRef.value.style.zIndex = String(getHighestZIndex() + 1)
  }
}

// 获取最高z-index
const getHighestZIndex = () => {
  const elements = document.querySelectorAll('*')
  let highest = 0
  elements.forEach((el) => {
    const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0
    if (zIndex > highest) {
      highest = zIndex
    }
  })
  return highest
}

// 拖拽功能
const startDrag = (e: MouseEvent) => {
  if (!props.draggable) return
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
  startX.value = e.clientX
  startY.value = e.clientY
  startLeft.value = dialogLeft.value
  startTop.value = dialogTop.value

  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.cursor = 'move'
  document.body.style.userSelect = 'none'
}

const handleDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  const deltaX = e.clientX - startX.value
  const deltaY = e.clientY - startY.value

  dialogLeft.value = startLeft.value + deltaX
  dialogTop.value = startTop.value + deltaY

  // 移除边界检查，允许拖拽到窗口外
  // const maxLeft = window.innerWidth - dialogWidth.value
  // const maxTop = window.innerHeight - dialogHeight.value
  // dialogLeft.value = Math.max(0, Math.min(maxLeft, dialogLeft.value))
  // dialogTop.value = Math.max(0, Math.min(maxTop, dialogTop.value))
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = 'default'
  document.body.style.userSelect = 'auto'
}

// 尺寸调整功能
const startResize = (direction: 'left' | 'right' | 'bottom' | 'corner', e: MouseEvent) => {
  if (!props.resizable) return
  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  resizeDirection.value = direction
  startX.value = e.clientX
  startY.value = e.clientY
  startLeft.value = dialogLeft.value
  startTop.value = dialogTop.value
  startWidth.value = dialogWidth.value
  startHeight.value = dialogHeight.value

  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.userSelect = 'none'
}

const handleResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return

  const deltaX = e.clientX - startX.value
  const deltaY = e.clientY - startY.value

  switch (resizeDirection.value) {
    case 'right':
      const newWidth = Math.max(props.minWidth, Math.min(props.maxWidth, startWidth.value + deltaX))
      dialogWidth.value = newWidth
      break
    case 'left':
      const leftNewWidth = Math.max(
        props.minWidth,
        Math.min(props.maxWidth, startWidth.value - deltaX),
      )
      const widthDiff = startWidth.value - leftNewWidth
      dialogWidth.value = leftNewWidth
      dialogLeft.value = startLeft.value + widthDiff
      break
    case 'bottom':
      const newHeight = Math.max(
        props.minHeight,
        Math.min(props.maxHeight, startHeight.value + deltaY),
      )
      dialogHeight.value = newHeight
      break
    case 'corner':
      const cornerNewWidth = Math.max(
        props.minWidth,
        Math.min(props.maxWidth, startWidth.value + deltaX),
      )
      const cornerNewHeight = Math.max(
        props.minHeight,
        Math.min(props.maxHeight, startHeight.value + deltaY),
      )
      dialogWidth.value = cornerNewWidth
      dialogHeight.value = cornerNewHeight
      break
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = 'default'
  document.body.style.userSelect = 'auto'
}

// 键盘事件
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    emit('update:visible', false)
  }
}

// 居中显示
const centerDialog = () => {
  if (!dialogRef.value) return

  const rect = dialogRef.value.getBoundingClientRect()
  dialogLeft.value = (window.innerWidth - rect.width) / 2
  dialogTop.value = (window.innerHeight - rect.height) / 2
}

// 监听窗口大小变化
const handleResize = () => {
  centerDialog()
}

// 生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
  centerDialog()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', stopResize)
})

// 监听visible变化
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      centerDialog()
    }
  },
)
</script>

<style scoped>
.custom-dialog {
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  min-width: 300px;
  min-height: 200px;
  z-index: 1000;
  border: 1px solid #e4e7ed;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  cursor: move;
  user-select: none;
  background: #fafafa;
  border-radius: 8px 8px 0 0;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #909399;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f7fa;
  color: #409eff;
}

.dialog-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  background: white;
  /* 确保滚轮滚动正常工作 */
  scroll-behavior: smooth;
  /* 防止内容溢出 */
  word-wrap: break-word;
}

/* 调整尺寸手柄 */
.resize-handle {
  position: absolute;
  background: transparent;
  z-index: 1000;
}

.resize-handle-left {
  left: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
}

.resize-handle-right {
  right: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
}

.resize-handle-bottom {
  bottom: -3px;
  left: 0;
  width: 100%;
  height: 6px;
  cursor: ns-resize;
}

.resize-handle-corner {
  right: -6px;
  bottom: -6px;
  width: 12px;
  height: 12px;
  cursor: nw-resize;
}

.resize-handle:hover {
  background: rgba(64, 158, 255, 0.1);
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.3s ease;
}

.dialog-fade-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.dialog-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 响应式 */
@media (max-width: 768px) {
  .custom-dialog {
    margin: 20px;
    width: calc(100vw - 40px) !important;
    height: calc(100vh - 40px) !important;
  }
}
</style>
