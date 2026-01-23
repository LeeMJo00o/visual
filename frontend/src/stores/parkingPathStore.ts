import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface ParkingPathTarget {
  x: number
  y: number
  heading: number
}

export const useParkingPathStore = defineStore('parkingPath', () => {
  const readStoredState = () => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return {}
      }
      const storedStateRaw = window.localStorage.getItem('parkingPathState')
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
  const target = ref<ParkingPathTarget | null>(null)
  const previewPath = ref<ParkingPathTarget[] | null>(null)
  const planning = ref(false)
  const planValid = ref(false)

  function startMode(id: string) {
    active.value = true
    vehicleId.value = id
    target.value = null
    previewPath.value = null
    planning.value = false
    planValid.value = false
  }

  function setTarget(next: ParkingPathTarget | null) {
    target.value = next
  }

  function setPreviewPath(next: ParkingPathTarget[] | null, valid: boolean) {
    previewPath.value = next
    planValid.value = valid
  }

  function reset() {
    active.value = false
    vehicleId.value = ''
    target.value = null
    previewPath.value = null
    planning.value = false
    planValid.value = false
  }

  watch(
    () => ({ active: active.value, vehicleId: vehicleId.value }),
    (state: { active: boolean; vehicleId: string }) => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) {
          return
        }
        window.localStorage.setItem('parkingPathState', JSON.stringify(state))
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
    previewPath,
    planning,
    planValid,
    startMode,
    setTarget,
    setPreviewPath,
    reset,
  }
})
