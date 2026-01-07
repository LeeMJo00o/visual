<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import ApplicationManager from '../routing_map/main.ts'

import { useGlobalStore } from '@/stores/globalStore'

const globalStore = useGlobalStore()
const gameContainer = ref<HTMLDivElement | null>(null)
let appManager: ApplicationManager | null = null

// 处理窗口大小变化
const handleResize = () => {
  if (appManager && appManager.app && gameContainer.value) {
    appManager.app.renderer.resize(
      gameContainer.value.clientWidth,
      gameContainer.value.clientHeight,
    )
  }
}

// 当进行回放的时候，需要不去处理当前websocket的数据
watch(
  () => globalStore.isReplay,
  (newVal) => {
    // 每次变化，都需要先清空当前的游戏实例
    if (newVal === true) {
      // 如果是回放模式，停止当前的游戏实例
      appManager?.pauseWSDataRendering()
    } else if (newVal === false) {
      // 如果不是回放模式，恢复游戏实例
      appManager?.resumeWSDataRendering()
    }
  },
)

// 组件挂载时初始化游戏
onMounted(async () => {
  // 使用单例模式获取应用管理器实例
  appManager = ApplicationManager.getInstance()

  // 如果还没有初始化，则进行初始化
  if (!appManager.mainContainer) {
    await appManager.init()
  }

  // 添加窗口大小变化的监听
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理资源
onUnmounted(() => {
  // 移除窗口大小变化监听
  window.removeEventListener('resize', handleResize)

  // 注意：不在这里清理ApplicationManager，因为它是单例
  // 只有在页面完全卸载时才会清理
})
</script>

<template>
  <div class="map-container">
    <div id="map_main_container" ref="gameContainer">
      <!-- PixiJS 会在这里渲染游戏画布 -->
    </div>
  </div>
</template>

<style scoped>
.map-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
}
</style>
