<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import ApplicationManager from '../routing_map/main.js'

const gameContainer = ref<HTMLDivElement | null>(null)
let appManager: ApplicationManager | null = null

// 处理窗口大小变化
const handleResize = () => {
  if (appManager && appManager.app && gameContainer.value) {
    appManager.app.renderer.resize(gameContainer.value.clientWidth, gameContainer.value.clientHeight)
  }
}

// 组件挂载时初始化游戏
onMounted(async () => {
  // 创建并初始化应用管理器
  appManager = new ApplicationManager()
  await appManager.init()

  // 添加窗口大小变化的监听
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理资源
onUnmounted(() => {
  // 清理所有资源
  if (appManager) {
    appManager.cleanup()
    appManager = null
  }

  // 移除窗口大小变化监听
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="map-container">
    <div id="map_main_container" ref="gameContainer">
      <!-- PixiJS 会在这里渲染游戏画布 -->
    </div>
    <div class="vertical-line"></div>
  </div>
</template>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  /* border-top: 1px solid #acacac; */
}

.game-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
