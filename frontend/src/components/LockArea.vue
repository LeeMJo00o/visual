<script setup lang="ts">
import ApplicationManager from '../routing_map/main.js'

const handleDrawBox = () => {
  console.log('画框功能已激活')
  const appManager = ApplicationManager.getInstance()
  appManager.setMouseFunction('draw')
}
</script>

<template>
  <div class="lock-area-func">
    <el-button type="primary" plain @click="handleDrawBox">start draw</el-button>
  </div>
</template>

<style scoped>
.lock-area-func {
  display: block;
}
</style>
