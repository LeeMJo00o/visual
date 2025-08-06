// 优先级相关的全局状态

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePriorityStore = defineStore('priority', () => {
  // 优先级显示开关
  const visible = ref(true)

  // 更新visible
  function setVisible(v: boolean) {
    visible.value = v
  }


  return {
    visible,
    setVisible,
  }
})
