import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import ApplicationManager from '../routing_map/main'

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

export const useLockAreaStore = defineStore('lockArea', () => {
  // 锁闭区列表对话框状态
  const lockAreaDialogVisible = ref(false)
  const lockAreas = ref<LockAreaListItem[]>([])
  const isLoading = ref(false)

  // 计算属性
  const lockAreaCount = computed(() => lockAreas.value.length)

  // 获取ApplicationManager实例
  function getApplicationManager(): ApplicationManager | null {
    return (
      (window as Window & { __applicationManagerInstance?: ApplicationManager })
        .__applicationManagerInstance || null
    )
  }

  // 更新锁闭区列表
  function updateLockAreaList() {
    const manager = getApplicationManager()
    if (manager && manager.lockAreas) {
      lockAreas.value = Object.entries(manager.lockAreas)
        .map(([id, graphics]) => {
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

  // 删除锁闭区
  async function deleteLockArea(areaId: string) {
    if (isLoading.value) return

    try {
      isLoading.value = true

      // 导入axios
      const { default: axios } = await import('axios')

      console.log('删除锁闭区:', areaId)

      // 发送删除请求到后端
      const response = await axios.delete(`/api/map/delete_lock_area/${areaId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('删除锁闭区成功:', response.data)

      // 从本地列表中移除
      lockAreas.value = lockAreas.value.filter((area) => area.id !== areaId)

      // 从ApplicationManager中移除图形
      const manager = getApplicationManager()
      if (manager && manager.lockAreas && manager.lockAreas[areaId]) {
        const graphics = manager.lockAreas[areaId]
        if (graphics && graphics.parent) {
          graphics.parent.removeChild(graphics)
        }
        delete manager.lockAreas[areaId]
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

    // 方法
    getApplicationManager,
    updateLockAreaList,
    deleteLockArea,
    toggleLockAreaDialog,
  }
})
