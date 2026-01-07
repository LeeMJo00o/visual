import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import ApplicationManager from '../routing_map/main'
import axios from 'axios'

// 定义锁闭区接口
export interface LockArea {
  name?: string
  type?: string
  subtype?: string
  created_by?: string
  describe?: string
  polygon: Array<{ x: number; y: number }>
}

export interface LockAreaListItem {
  id: string
  name: string
  area: LockArea
}


const createLockAreaStore = (storeId: string, manager_key: string, type: string) => {
  return defineStore(storeId, () => {
    console.log("type", type, "manager_key", manager_key)
    // 锁闭区列表对话框状态
    const lockAreaDialogVisible = ref(false)
    const lockAreas = ref<LockAreaListItem[]>([])
    const isLoading = ref(false)

    // 计算属性
    const lockAreaCount = computed(() => lockAreas.value.length)

    // 当前选中的区域
    const currentLockArea = ref<LockAreaListItem | null>(null)

    // 获取ApplicationManager实例
    function getApplicationManager(): ApplicationManager | null {
      return (
        (window as Window & { __applicationManagerInstance?: ApplicationManager })
          .__applicationManagerInstance || null
      )
    }

    // 当前选中的区域
    function selectLockArea(row: LockAreaListItem | null, column: any, e: any) {
      currentLockArea.value = currentLockArea.value === row ? null : row
    }

    // 更新锁闭区列表 - 弹窗显示用
    function updateLockAreaList() {
      console.log("updateLockAreaList")
      const manager = getApplicationManager()
      const lockAreas_key = manager_key as keyof typeof manager;
      if (manager && manager?.[lockAreas_key]) {
        lockAreas.value = Object.entries(manager[lockAreas_key])
          .map(([id, graphics]) => {
            console.log("map", id, graphics)
            const areaData = (graphics as any).areaData as LockArea
            return {
              id,
              name: areaData?.name || id,
              area: areaData || { polygon: [] },
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      }
    }

    // 增加/更新锁闭区请求
    async function addOrUpdateLockArea(areaData: LockArea) {
      try {
        isLoading.value = true
        // 发送添加请求到后端
        const response = await axios.post(
          '/api/area/add_update_lock_area',
          {
            type,
            area_data: areaData,
          },{
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
        console.log('更新锁闭区请求成功:', type, response.data)
      }catch (error) {
        console.error('增加/更新锁闭区失败:', error)
      }finally{
        isLoading.value = false
      }
    }

    // 删除锁闭区
    async function deleteLockArea(areaId: string) {
      if (isLoading.value) return

      try {
        isLoading.value = true

        console.log('删除锁闭区:', areaId)

        // 发送删除请求到后端
        const response = await axios.post(
          '/api/area/del_lock_area',
          {
            type,
            area_id: areaId,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )

        console.log('删除锁闭区成功:', response.data)

        // 从本地列表中移除
        lockAreas.value = lockAreas.value.filter((area) => area.id !== areaId)

        // 从ApplicationManager中移除图形
        const manager = getApplicationManager()
        const lockAreas_key = manager_key as keyof typeof manager;
        if (manager && manager?.[lockAreas_key] && manager[lockAreas_key][areaId]) {
          const graphics = manager[lockAreas_key][areaId]
          if (graphics && graphics.parent) {
            graphics.parent.removeChild(graphics)
          }
          delete manager[lockAreas_key][areaId]
        }

        // 显示成功消息
        const { ElMessage } = await import('element-plus')
        ElMessage.success('锁闭区删除成功')
      } catch (error) {
        console.error('删除锁闭区失败:', error)

        // 显示错误消息
        try {
          const { ElMessage } = await import('element-plus')
          ElMessage.error('删除锁闭区失败: ' + (error.response?.data?.message || error.message))
        } catch (importError) {
          console.error('无法加载Element Plus消息组件:', importError)
          alert('删除锁闭区失败: ' + (error.response?.data?.message || error.message))
        }
      } finally {
        isLoading.value = false
      }
    }

    // 显示/隐藏锁闭区对话框
    function toggleLockAreaDialog() {
      lockAreaDialogVisible.value = !lockAreaDialogVisible.value
      if (lockAreaDialogVisible.value) {
        // 打开对话框时更新列表
        updateLockAreaList()
      }
    }

    return {
      // 状态
      lockAreaDialogVisible,
      lockAreas,
      isLoading,

      // 计算属性
      lockAreaCount,

      // 当前选中的area
      currentLockArea,

      // 方法
      getApplicationManager,
      selectLockArea,
      updateLockAreaList,
      addOrUpdateLockArea,
      deleteLockArea,
      toggleLockAreaDialog,
    }
  })
}

// 禁行区
export const useLockAreaStore = createLockAreaStore('lockArea', 'lockAreas', 'lock')
// 流量监控区，限制区域内的车辆数
export const useLimitAreaStore = createLockAreaStore('limitArea', 'limitAreas', 'limit')
// 电子围栏
export const useGeoFenceStore = createLockAreaStore('geoFence', 'geoFences', 'trigger')


export const storeMap = {
  lock: useLockAreaStore,
  limit: useLimitAreaStore,
  trigger: useGeoFenceStore
} as const;
