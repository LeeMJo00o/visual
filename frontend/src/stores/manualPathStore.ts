import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface ManualPathTarget {
  x: number
  y: number
  heading: number
}

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

  const storedState = readStoredState() as {
    active?: boolean
    vehicleId?: string
    snapToLane?: boolean
  }
  const active = ref(Boolean(storedState.active))
  const vehicleId = ref(storedState.vehicleId || '')
  const snapToLane = ref(storedState.snapToLane ?? true)
  const target = ref<ManualPathTarget | null>(null)
  const preview = ref<ManualPathTarget | null>(null)
  const planning = ref(false)
  const planValid = ref(false)

  function startMode(id: string) {
    active.value = true
    vehicleId.value = id
    target.value = null
    preview.value = null
    planning.value = false
    planValid.value = false
  }

  function setTarget(next: ManualPathTarget | null) {
    target.value = next
  }

  function setPreview(next: ManualPathTarget | null, valid: boolean) {
    preview.value = next
    planValid.value = valid
  }

  function reset() {
    active.value = false
    vehicleId.value = ''
    target.value = null
    preview.value = null
    planning.value = false
    planValid.value = false
  }

  watch(
    () => ({ active: active.value, vehicleId: vehicleId.value, snapToLane: snapToLane.value }),
    (state: { active: boolean; vehicleId: string; snapToLane: boolean }) => {
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
    planning,
    planValid,
    snapToLane,
    startMode,
    setTarget,
    setPreview,
    reset,
  }
})
