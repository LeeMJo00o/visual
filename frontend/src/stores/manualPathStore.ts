import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ManualPathTarget {
  x: number
  y: number
  heading: number
}

export const useManualPathStore = defineStore('manualPath', () => {
  const active = ref(false)
  const vehicleId = ref('')
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

  return {
    active,
    vehicleId,
    target,
    preview,
    planning,
    planValid,
    startMode,
    setTarget,
    setPreview,
    reset,
  }
})
