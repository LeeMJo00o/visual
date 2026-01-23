import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface ManualPathTarget {
  x: number
  y: number
  heading: number
}

export type ManualPathPlanType = 'lane' | 'hybrid' | null

export const useManualPathStore = defineStore('manualPath', () => {
  const readStoredState = () => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return {}
      }
      const storedStateRaw = window.localStorage.getItem('manualPathState')
      if (!storedStateRaw) {
        return {}
      }
      return JSON.parse(storedStateRaw)
    } catch (error) {
      return {}
    }
  }

  const storedState = readStoredState() as { active?: boolean; vehicleId?: string }
  const active = ref(Boolean(storedState.active))
  const vehicleId = ref(storedState.vehicleId || '')
  const target = ref<ManualPathTarget | null>(null)
  const preview = ref<ManualPathTarget | null>(null)
  const previewPath = ref<ManualPathTarget[] | null>(null)
  const planning = ref(false)
  const planValid = ref(false)
  const planType = ref<ManualPathPlanType>(null)

  function startMode(id: string) {
    active.value = true
    vehicleId.value = id
    target.value = null
    preview.value = null
    previewPath.value = null
    planning.value = false
    planValid.value = false
    planType.value = null
  }

  function setTarget(next: ManualPathTarget | null) {
    target.value = next
  }

  function setPreview(next: ManualPathTarget | null, valid: boolean) {
    preview.value = next
    previewPath.value = null
    planValid.value = valid
    planType.value = next ? 'lane' : null
  }

  function setPreviewPath(next: ManualPathTarget[] | null, valid: boolean) {
    previewPath.value = next
    preview.value = null
    planValid.value = valid
    planType.value = next ? 'hybrid' : null
  }

  function reset() {
    active.value = false
    vehicleId.value = ''
    target.value = null
    preview.value = null
    previewPath.value = null
    planning.value = false
    planValid.value = false
    planType.value = null
  }

  watch(
    () => ({ active: active.value, vehicleId: vehicleId.value }),
    (state: { active: boolean; vehicleId: string }) => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) {
          return
        }
        window.localStorage.setItem('manualPathState', JSON.stringify(state))
      } catch (error) {
        // ignore storage failures
      }
    },
    { deep: true },
  )

  return {
    active,
    vehicleId,
    target,
    preview,
    previewPath,
    planning,
    planValid,
    planType,
    startMode,
    setTarget,
    setPreview,
    setPreviewPath,
    reset,
  }
})
