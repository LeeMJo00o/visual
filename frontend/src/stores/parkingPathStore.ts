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

  const storedState = readStoredState() as {
    active?: boolean
    vehicleId?: string
    previewPath?: ParkingPathTarget[] | null
    planValid?: boolean
    reverseStart?: boolean
    snapToLane?: boolean
    driving?: boolean
  }
  const active = ref(Boolean(storedState.active))
  const vehicleId = ref(storedState.vehicleId || '')
  const target = ref<ParkingPathTarget | null>(null)
  const previewPath = ref<ParkingPathTarget[] | null>(storedState.previewPath || null)
  const planning = ref(false)
  const planValid = ref(Boolean(storedState.planValid))
  const reverseStart = ref(Boolean(storedState.reverseStart))
  const snapToLane = ref(storedState.snapToLane ?? true)
  const driving = ref(Boolean(storedState.driving))

  function startMode(id: string) {
    active.value = true
    vehicleId.value = id
    target.value = null
    previewPath.value = null
    planning.value = false
    planValid.value = false
    reverseStart.value = false
    driving.value = false
  }

  function setTarget(next: ParkingPathTarget | null) {
    target.value = next
  }

  function setPreviewPath(next: ParkingPathTarget[] | null, valid: boolean, reverse = false) {
    previewPath.value = next
    planValid.value = valid
    reverseStart.value = reverse
    if (!next || !valid) {
      driving.value = false
    }
  }

  function setDriving(active: boolean) {
    driving.value = active
  }

  function reset() {
    active.value = false
    vehicleId.value = ''
    target.value = null
    previewPath.value = null
    planning.value = false
    planValid.value = false
    reverseStart.value = false
    driving.value = false
  }

  watch(
    () => ({
      active: active.value,
      vehicleId: vehicleId.value,
      previewPath: previewPath.value,
      planValid: planValid.value,
      reverseStart: reverseStart.value,
      snapToLane: snapToLane.value,
      driving: driving.value,
    }),
    (state: {
      active: boolean
      vehicleId: string
      previewPath: ParkingPathTarget[] | null
      planValid: boolean
      reverseStart: boolean
      snapToLane: boolean
      driving: boolean
    }) => {
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
    reverseStart,
    snapToLane,
    driving,
    startMode,
    setTarget,
    setPreviewPath,
    setDriving,
    reset,
  }
})
