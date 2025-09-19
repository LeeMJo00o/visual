<template>
  <div class="replay-container">
    <el-select v-model="selectedFile" placeholder="请选择项目">
      <el-option
        v-for="item in fileListOption"
        :key="item.name"
        :label="item.name"
        :value="item.name"
      />
    </el-select>
    <el-date-picker
      v-model="timeRange"
      type="daterange"
      start-placeholder="Start Date"
      end-placeholder="End Date"
      :default-value="[new Date(2010, 9, 1), new Date(2010, 10, 1)]"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { queryReplayDBFileList } from '../api/index.js'
const timeRange = ref([])

const fileListOption = ref([])

const selectedFile = ref('')

const getReplayDBFileList = () => {
  queryReplayDBFileList().then((res) => {
    console.log(res)
    if (res.data.code === 200) {
      fileListOption.value = res.data.data
    }
  })
}
onMounted(() => {
  getReplayDBFileList()
})
</script>

<style scoped>
.replay-container {
  position: relative;
  width: 100%;
  height: 100%;
  display:flex;
}
</style>
