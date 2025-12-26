<script setup lang="ts">
import { ref, watch } from 'vue'
import PixiGame from '../components/RoutingMap.vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useGlobalStore } from '../stores/globalStore'
// import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import LockArea from '@/components/LockArea.vue'
import LockAreaList from '@/components/LockAreaList.vue'
import AgentsManager from '@/components/AgentsManager.vue'
import VehicleList from '@/components/VehicleList.vue'
import WeightScaleConfig from '@/components/WeightScaleConfig.vue'
import PriorityConfig from '@/components/PriorityConfig.vue'
import SpeedFmsConfig from '@/components/SpeedFmsConfig.vue'
import Infos from '@/components/Infos.vue'

import ReplayConfig from '@/components/ReplayConfig.vue'
import ApplicationManager from '../routing_map/main.ts'
import { storeToRefs } from 'pinia'
import { useGlobalSettingsStore } from '@/stores/useLocalStorage'
import { useDynamicVpbStore } from '@/stores/dynamicVpbStore'

const dynamicVpbStore = useDynamicVpbStore()



const settingsStore = useGlobalSettingsStore()

// 获取响应式的 settings（需要使用 storeToRefs 保持响应性）
const { globalSettings } = storeToRefs(settingsStore)

// 声明全局接口
declare global {
  interface Window {
    updateClickPosition: (x: number, y: number) => void
    updatePointerPosition: (x: number, y: number) => void
  }
}

const globalStore = useGlobalStore()

const isReplay = ref<boolean>(false)
watch(
  () => globalStore.isReplay,
  (newValue) => {
    isReplay.value = newValue
  },
  { deep: true },
)

// 监听地图显示状态
watch(() => globalSettings.value.map_show, (newValue, oldValue) => {
  // 只处理地图相关的逻辑
  const ins = ApplicationManager.getInstance()
  ins.map_container.visible = newValue
})


// 监听底图显示状态
watch(() => globalSettings.value.map_show, (newValue, oldValue) => {
  // 只处理地图相关的逻辑
  const ins = ApplicationManager.getInstance()
  ins.toggleBackgroundImage(newValue)
})

// 添加当前选中的菜单项
const currentMenu = ref('main-map')

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
    const response = await axios.post('/api/map/change_weight', {
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

/**
 * 显示隐藏 self_area | ga_area |  pga_area |  pla_area
 */
const handleVisibleAgent = (type: string) => {

  window.dispatchEvent(new CustomEvent(type))
}

// const onImageHide = () => {
//   window.dispatchEvent(new CustomEvent('image-hide-click'))
// }
const handleChangeIsReplay = () => {
  globalStore.setIsReplay(!globalStore.isReplay)
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
            <el-menu-item index="main-map">
              <span>Main Map</span>
            </el-menu-item>

            <el-menu-item index="2">
              <span>Map Tools</span>
            </el-menu-item>

            <el-menu-item index="agents-manager">
              <span>Agent List</span>
            </el-menu-item>

            <el-menu-item index="lock-area">
              <span>Lock Area</span>
            </el-menu-item>

            <el-menu-item index="limit-area">
              <span>Traffic Control</span>
            </el-menu-item>

            <!-- 电子围栏 -->
            <el-menu-item index="geo-fence">
              <span>Geo-fence</span>
            </el-menu-item>

            <el-menu-item index="weight-scale-config">
              <span>Weight Scale Config</span>
            </el-menu-item>

            <el-menu-item index="priority-config">
              <span>Priority Config</span>
            </el-menu-item>

            <el-menu-item index="speed-config">
              <span>Speed Config</span>
            </el-menu-item>

            <el-menu-item index="Infos">
              <span>Infos</span>
            </el-menu-item>
          </el-menu>
        </div>
      </el-aside>

      <el-main>
        <el-container class="inner-container">
          <div class="top-section">
            <div v-if="currentMenu === 'main-map'">
              <div class="slider-container">
                <div class="label-and-buttons">
                  <el-form :inline="true" size="small">
                    <el-form-item label="显示所有vpb">
                      <el-tooltip
                        effect="dark"
                        content="切换刷新页面生效"
                        placement="bottom"
                      >
                        <el-switch
                          v-model="globalSettings.all_vpb_show"
                          class="ml-2"
                          inline-prompt
                          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
                        />
                      </el-tooltip>
                    </el-form-item>

                    <el-form-item label="显示地图">
                      <el-switch
                        v-model="globalSettings.map_show"
                        style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949" />
                    </el-form-item>

                    <el-form-item label="显示底图">
                      <el-switch
                        v-model="globalSettings.background_image_show"
                        style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949" />
                    </el-form-item>
                  </el-form>
                  
                  

                  

                  <!-- <el-button type="primary" plain id="map_hide" @click="onMapHide"
                    >map show</el-button
                  > -->
                  <!-- <el-button type="primary" plain id="image_hide" @click="onImageHide"
                    >image show</el-button
                  > -->
                  <el-button type="primary" plain id="agent_hide" @click="onAgentHide"
                    >agent show</el-button
                  >
                  <el-button
                    type="primary"
                    plain
                    id="agent_hide"
                    @click="handleVisibleAgent('self_area_visible')"
                    >self_area show</el-button
                  >
                  <el-button
                    type="primary"
                    plain
                    id="agent_hide"
                    @click="handleVisibleAgent('ga_area_visible')"
                    >ga_area show</el-button
                  >
                  <el-button
                    type="primary"
                    plain
                    id="agent_hide"
                    @click="handleVisibleAgent('pga_area_visible')"
                    >pga_area show</el-button
                  >
                  <el-button
                    type="primary"
                    plain
                    id="agent_hide"
                    @click="handleVisibleAgent('pla_area_visible')"
                    >pla_area show</el-button
                  >
                  <el-switch
                    v-model="isReplay"
                    class="ml-2"
                    inline-prompt
                    style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
                    active-text="回放开启"
                    inactive-text="回放禁用"
                    @change="handleChangeIsReplay"
                  />
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
              <span style="margin-left: 20px">
                pointer:
                {{
                  globalStore.positions.pointer
                    ? `[${globalStore.positions.pointer[0].toFixed(4)}, ${globalStore.positions.pointer[1].toFixed(4)}]`
                    : ''
                }}
              </span>
            </div>

            <div v-else-if="currentMenu === 'agents-manager'">
              <AgentsManager />
            </div>

            <div v-else-if="currentMenu === 'lock-area'">
              <LockArea type="lock" text="Lock Area" />
            </div>

            <div v-else-if="currentMenu === 'limit-area'">
              <LockArea type="limit" text="Traffic Control" />
            </div>

            <div v-else-if="currentMenu === 'geo-fence'">
              <LockArea type="trigger" text="Geo-fence" />
            </div>

            <div v-else-if="currentMenu === 'weight-scale-config'">
              <WeightScaleConfig />
            </div>

            <div v-else-if="currentMenu === 'priority-config'">
              <PriorityConfig />
            </div>

            <div v-else-if="currentMenu === 'speed-config'">
              <SpeedFmsConfig />
            </div>
            <div v-else-if="currentMenu === 'Infos'">
              <Infos />
            </div>

            <div v-else>
              <!-- <h3>请选择一个功能</h3> -->
            </div>
          </div>
          <!-- 下方主区域 -->
          <div class="main-map">
            <PixiGame />
          </div>

          <!-- <ReplayConfig /> -->
          <div class="bottom-fotter" v-if="isReplay">
            <ReplayConfig />
          </div>
        </el-container>
      </el-main>
    </el-container>
  </div>

  <!-- 车辆列表对话框 -->
  <VehicleList />

  <!-- 锁闭区列表对话框 -->
  <LockAreaList type="lock" />

  <!-- 流量控制区域列表对话框 -->
  <LockAreaList type="limit" />

  <!-- 电子围栏区域列表对话框 -->
  <LockAreaList type="trigger" />
</template>

<style scoped>
/* 基础布局 */
.common-layout {
  height: 100vh;
  width: 100%;
  display: flex;
}

.el-container {
  flex: 1;
  display: flex;
}

/* 侧边栏 - 已隐藏 */
/* .the_side {
  display: none;
} */

.el-main {
  flex: 1;
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
  margin-bottom: 10px;
}

.main-map {
  flex: 1;
  position: relative;
}
.bottom-fotter {
  height: 80px;
}

/* 滑块相关样式 */
.slider-container {
  display: flex;
  align-items: center;
  gap: 16px;
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
  z-index: 400;
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

/* 车辆控制按钮包装器样式 */
.vehicle-controls-wrapper {
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}
.bottom-fotter {
  background-color: #fff;
}
</style>
