<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import ApplicationManager from '../routing_map/main.ts'

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
