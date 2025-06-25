<script setup lang="ts">
import { ref } from 'vue'
import PixiGame from '../components/RoutingMap.vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useGlobalStore } from '../stores/globalStore'
// import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

// 声明全局接口
declare global {
  interface Window {
    updateClickPosition: (x: number, y: number) => void
    updatePointerPosition: (x: number, y: number) => void
  }
}

const globalStore = useGlobalStore()

// 添加当前选中的菜单项
const currentMenu = ref('1')

// 滑块数值
const sliderValue = ref(0)

// 侧边栏控制
const isSidebarCollapsed = ref(false)
const sidebarWidth = ref(200)

// 处理侧边栏展开/收起
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  sidebarWidth.value = isSidebarCollapsed.value ? 0 : 200
}

// 处理菜单选择事件
const handleMenuSelect = (index: string) => {
  currentMenu.value = index
}

// 滑块变化处理函数
const handleSliderChange = async (value: number) => {
  try {
    // 发送 HTTP 请求，将滑块值传递给服务器
    const response = await axios.post('/api/demo/change_weight', {
      value: value,
    })
    ElMessage({ message: `set global sequece weight to ${value} ok`, type: 'success' })
    console.log('请求成功:', response.data)
  } catch (error) {
    ElMessage({ message: `set global sequece weight to error: ${error}`, type: 'error' })
    console.error('请求失败:', error)
  }
}

const onMapHide = () => {
  window.dispatchEvent(new CustomEvent('map-hide-click'))
}

const onAgentHide = () => {
  window.dispatchEvent(new CustomEvent('agent-hide-click'))
}
</script>

<template>
  <div class="common-layout">
    <el-container>
      <el-aside class="the_side" :width="`${sidebarWidth}px`">
        <div class="sidebar-toggle" @click="toggleSidebar">
          <el-icon :class="{ 'is-collapsed': isSidebarCollapsed }">
            <component :is="isSidebarCollapsed ? 'ArrowRight' : 'ArrowLeft'" />
          </el-icon>
        </div>
        <div class="el-menu-wrapper">
          <el-menu
            :default-active="currentMenu"
            background-color="#f5f5f5"
            text-color="#333"
            @select="handleMenuSelect"
            :collapse="isSidebarCollapsed"
          >
            <el-menu-item index="1">
              <span>The func one 4</span>
            </el-menu-item>

            <el-menu-item index="2">
              <span>map tools</span>
            </el-menu-item>

            <el-menu-item index="3">
              <span>No func2</span>
            </el-menu-item>

            <el-sub-menu index="4">
              <template #title>
                <span>The func group</span>
              </template>
              <el-menu-item index="3-1">The func group's one</el-menu-item>
              <el-menu-item index="3-2">The func group's two</el-menu-item>
            </el-sub-menu>
          </el-menu>
        </div>
      </el-aside>

      <el-main>
        <el-container class="inner-container">
          <div>
            <div class="top-section">
              <div v-if="currentMenu === '1'">
                <div class="slider-container">
                  <div class="label-and-buttons">
                    <el-button type="primary" plain id="map_hide" @click="onMapHide"
                      >map show</el-button
                    >
                    <el-button type="primary" plain id="agent_hide" @click="onAgentHide"
                      >agent show</el-button
                    >
                    <span class="slider-label">set global sequece weight: </span>
                    <span class="slider-value">{{ sliderValue.toFixed(1) }}</span>
                  </div>
                  <el-slider
                    placement="right"
                    :show-tooltip="true"
                    class="slider-component"
                    v-model="sliderValue"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    @change="handleSliderChange"
                  />
                </div>
              </div>

              <div v-else-if="currentMenu === '2'">
                <span>
                  click:
                  {{
                    globalStore.positions.click
                      ? `[${globalStore.positions.click[0].toFixed(4)}, ${globalStore.positions.click[1].toFixed(4)}]`
                      : ''
                  }}
                </span>
                <span style="margin-left: 20px;">
                  pointer:
                  {{
                    globalStore.positions.pointer
                      ? `[${globalStore.positions.pointer[0].toFixed(4)}, ${globalStore.positions.pointer[1].toFixed(4)}]`
                      : ''
                  }}
                </span>
              </div>
              <div v-else-if="currentMenu === '3-1'">
                <p>这里是子功能1的简要介绍...</p>
              </div>
              <div v-else-if="currentMenu === '3-2'">
                <p>这里是子功能2的简要介绍...</p>
              </div>
              <div v-else>
                <!-- <h3>请选择一个功能</h3> -->
              </div>
            </div>
          </div>
          <div class="divider"></div>
          <!-- 下方主区域 -->
          <div class="main-map">
            <PixiGame />
          </div>
        </el-container>
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
/* 基础布局 */
.common-layout {
  height: 100vh;
  width: 100%;
}

.el-container {
  flex: 1;
}

/* 侧边栏 - 已隐藏 */
/* .the_side {
  display: none;
} */

.el-main {
  padding: 0;
  background-color: #fff;
  border-left: 2px solid #dcdfe6;
}

/* Element Plus 组件样式覆盖 */
:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item.is-active) {
  background-color: #e3f3ff !important;
  color: #000 !important;
}

/* 主容器结构 */
.inner-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.divider {
  height: 1px;
  background-color: #dcdfe6;
  width: 100%;
}

.top-section {
  height: 100%;
}

.main-map {
  flex: 1;
  height: calc(100% - 120px);
}

/* 滑块相关样式 */
.slider-container {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 10px 0;
}
.label-and-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-demo-block {
  max-width: 400px;
  display: flex;
  align-items: center;
}

.el-slider {
  max-width: 200px;
}
.slider-demo-block .el-slider {
  margin-top: 0;
  margin-left: 12px;
}
.slider-demo-block .demonstration {
  font-size: 14px;
  /* color: var(--el-text-color-secondary); */
  line-height: 44px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0;
}
.slider-demo-block .demonstration + .el-slider {
  flex: 0 0 70%;
}

/* 侧边栏样式 */
.the_side {
  position: relative;
  transition: width 0.3s ease;
  overflow: visible;
  background-color: #f5f5f5;
}

/* 侧边栏切换按钮样式 */
.sidebar-toggle {
  position: absolute;
  right: -4px;
  top: 30%;
  transform: translateY(-50%);
  width: 8px;
  height: 60px;
  background-color: #409eff;
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: none;
  pointer-events: auto;
}

.sidebar-toggle:hover {
  background-color: #66b1ff;
  width: 12px;
  right: -6px;
}

.sidebar-toggle .el-icon {
  font-size: 12px;
  color: #ffffff;
  transition: none;
  opacity: 0.8;
}

.sidebar-toggle:hover .el-icon {
  opacity: 1;
}

/* 确保菜单在收起状态下也能正常显示 */
:deep(.el-menu) {
  border-right: none;
  transition: width 0.3s ease;
}

:deep(.el-menu--collapse) {
  width: 64px;
}

/* 添加一个容器来包裹菜单，确保菜单内容正确隐藏 */
.el-menu-wrapper {
  width: 100%;
  overflow: hidden;
  transition: width 0.3s ease;
}
</style>
