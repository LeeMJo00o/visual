<script setup lang="ts">
const handleDrawBox = () => {
  console.log('画框功能已激活')
  // 这里可以添加画框的具体逻辑
}
</script>

<template>
  <div class="lock-area-func">
    <el-button type="primary" plain @click="handleDrawBox">画框</el-button>
  </div>
</template>

<style scoped>
.lock-area-func {
  display: block;
}
</style>
