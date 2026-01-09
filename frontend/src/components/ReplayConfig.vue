<template>
  <div class="timeline-player">
    <!-- 时间轴 -->
    <div class="timeline">
      <el-slider
        v-model="currentTime"
        :min="startTime"
        :max="endTime"
        :step="1000"
        @change="handleSeek"
        :disabled="!isReplay"
        style="width: 100%"
        :format-tooltip="formatTime"
      />
      <div class="time-labels">
        <span>{{ formatTime(startTime) }}</span>
        <!-- 控制区 -->
        <div class="controls">
          <el-select
            v-model="selectedFile"
            :disabled="!isReplay"
            @change="handleFileChange"
            placeholder="Please select"
            filterable
            style="width: 200px; margin-right: 20px"
          >
            <el-option
              v-for="item in fileListOption"
              :key="item.name"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
          <el-button :disabled="!isReplay" @click="downLoadFile">Download File</el-button>
          <el-upload
            :disabled="!isReplay || isUploading"
            action="#"
            :show-file-list="false"
            :http-request="handleChange"
          >
            <el-button :disabled="!isReplay || isUploading">Upload DB File</el-button>
          </el-upload>
          
          <!-- 上传进度条 -->
          <el-progress
            v-if="isUploading"
            :percentage="uploadProgress"
            :stroke-width="10"
            style="width: 120px; margin-left: 10px"
          />

          <el-tooltip class="box-item" content="重置">
            <el-button :disabled="!isReplay" @click="reset" size="small" circle>
              <el-icon><Refresh /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip class="box-item" content="后退5秒">
            <el-button :disabled="!isReplay" @click="rewind(5000)" size="small" circle>
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip class="box-item" :content="!isPlaying ? '播放' : '暂停'">
            <el-button :disabled="!isReplay" @click="togglePlay" size="small" circle>
              <el-icon v-if="!isPlaying"><VideoPlay /></el-icon>
              <el-icon v-else><VideoPause /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip class="box-item" content="前进5秒">
            <el-button :disabled="!isReplay" @click="forward(5000)" size="small" circle>
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </el-tooltip>
          <span style="margin: 0 12px">{{ formatTime(currentTime) }}</span>

          <el-select
            v-model="playbackRate"
            :disabled="!isReplay"
            size="small"
            style="width: 80px; margin-left: 10px"
            @change="handleChangeRate"
          >
            <el-option v-for="rate in speedOptions" :key="rate" :value="rate" :label="rate + 'x'" />
          </el-select>
        </div>

        <span>{{ formatTime(endTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import {
  queryReplayDBFileList,
  queryReplayTimeRange,
  queryReplayData,
  downloadReplayDBFile,
  uploadReplayDBFile,
} from '@/api/index.js'
import { ElMessage } from 'element-plus'
import { Refresh, ArrowLeft, ArrowRight, VideoPlay, VideoPause } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { PosUpdateData, LockAreaUpdateData, PathUpdateData } from '@/routing_map/types'
import ApplicationManager from '@/routing_map/main'

import { useGlobalStore } from '@/stores/globalStore'

const globalStore = useGlobalStore()

// const appManager = ref<ApplicationManager | null>(null)
// const appManager = ApplicationManager.getInstance()
const appManager = ApplicationManager.getInstance()

const isReplay = computed(() => {
  return globalStore.isReplay
})

const startTime = ref<number>(0)
const endTime = ref<number>(0)

// 当前播放状态
const isPlaying = ref(false)
const currentTime = ref<number>(0) // 毫秒
const currentPercent = ref(0)
const timer = ref<number | null>(null)

// 上传状态
const isUploading = ref(false)
const uploadProgress = ref(0)

// 播放速度
const playbackRate = ref(1)
const speedOptions = ref([0.5, 1, 2, 4])

const fileListOption = ref<Array<{ name: string }>>([])

const selectedFile = ref('')

// 时间格式化
const formatTime = (time: number) => {
  if (!time) return '00:00:00'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 同步当前回放状态到全局 store，用于顶部时间显示
watch(
  () => selectedFile.value,
  (file) => {
    globalStore.setReplaySelectedFile(file)

    // 立即刷新顶部回放时间显示（避免等待 1s 定时器）
    appManager?.updateTopTimeDisplayNow?.()
  },
  { immediate: true },
)

watch(
  () => currentTime.value,
  (t) => {
    // 未选择文件时不显示时间，只显示 [RE]
    if (!selectedFile.value) {
      globalStore.setReplayCurrentTime(null)
      return
    }
    globalStore.setReplayCurrentTime(t)

    // 立即刷新顶部回放时间显示（拖动/播放都要无延迟同步）
    appManager?.updateTopTimeDisplayNow?.()
  },
  { immediate: true },
)

// 播放/暂停
const togglePlay = () => {
  console.log('togglePlay=', isPlaying.value)
  if (isPlaying.value) {
    stop()
  } else {
    play()
  }
}

const play = () => {
  isPlaying.value = true
  timer.value = window.setInterval(() => {
    currentTime.value += 1000
    if (currentTime.value >= endTime.value) {
      currentTime.value = endTime.value
      stop()
      ElMessage.success('播放完成')
    } else {
      getReplayRangeData()
    }

  }, 1000 / playbackRate.value)
}

const stop = () => {
  isPlaying.value = false
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}


// 拖动/点击时间轴
const handleSeek = (val: number) => {
  currentTime.value = val
  getReplayRangeData()
}

// 前进后退
const forward = (step: number=5000) => {
  currentTime.value = Math.min(endTime.value, currentTime.value + step)
  getReplayRangeData()
}
const rewind = (step: number=5000) => {
  currentTime.value = Math.max(startTime.value, currentTime.value - step)
  getReplayRangeData()
}

// 重置
const reset = () => {
  stop()
  currentTime.value = startTime.value
}

/**
 * 查询当前文件的使劲按范围
 */
const handleFileChange = (value: string) => {
  queryReplayTimeRange({ fileName: value }).then((res: any) => {
    if (res.data.code === 200) {
      currentTime.value = dayjs(res.data.data.start).valueOf()
      startTime.value = dayjs(res.data.data.start).valueOf()
      endTime.value = dayjs(res.data.data.end).valueOf()
      getReplayRangeData()
    } else {
      ElMessage.error(res.data.message || '获取回放时间范围失败')
    }
  })
}

/**
 * 查询一定时间范围内的回放数据,因为数据时间比较长，所以先获取10秒的数据，等到数据运行到5秒以后，再接着获取接下来的10秒的数据
 */
const getReplayRangeData = () => {
  const _startTime = currentTime.value
  queryReplayData({ fileName: selectedFile.value, t: _startTime }).then((res: any) => {
    if (res.status === 200) {
      const { data }: any = res.data.data
      for (let i = 0; i < data.length; i++) {
        const { type, subtype, data: _data } = data[i]
        if (type === 'map') {
          //  判断地图 是否和当前的一致,如果不一致,则需要提示用户
          if (_data.map_name !== selectedFile.value) {
            ElMessage.warning('当前回放文件对应的地图与当前地图不一致，请切换地图后再进行回放')
          }
          return
        }
        if (type === 'pose') {
          // 车辆定位
          appManager?.dataRenderer?.pose_update(data[i] as PosUpdateData)
        } else if (type === 'areas') {
          // subType === 'lock' 禁行区
          // subType === 'trigger'  电子围栏
          // subType === "traffic_control" 流量控制区域
          if (subtype === 'lock') {
            appManager?.dataRenderer?.areas_update(data[i] as LockAreaUpdateData, 'lock')
          }
          if (subtype === 'trigger') {
            appManager?.dataRenderer?.areas_update(data[i] as LockAreaUpdateData, 'trigger')
          }
          if (subtype === 'traffic_control') {
            appManager?.dataRenderer?.areas_update(data[i] as LockAreaUpdateData, 'limit')
          }
        } else if (type === 'polygon' && subtype === 'self_area') {
          // 多边形

          appManager?.dataRenderer.demo_update_polygon({
            data: data[i].data,
            type: subtype,
            subtype,
          })
        } else if (type === 'polygon' && subtype === 'ga') {
          // GA
          appManager?.dataRenderer.demo_update_polygon({
            data: data[i].data,
            type: subtype,
            subtype,
          })
        } else if (type === 'polygon' && subtype === 'pga') {
          // pga
          appManager?.dataRenderer.demo_update_polygon({
            data: data[i].data,
            type: subtype,
            subtype,
          })
        } else if (type === 'polygon' && subtype === 'pla') {
          // pla
          appManager?.dataRenderer.demo_update_polygon({
            data: data[i].data,
            type: subtype,
            subtype,
          })
        } else if (type === 'long' || type === 'short') {
          // 长路径数据 | 短路径数据
          appManager?.dataRenderer?.demo_update_path(data[i] as PathUpdateData)
        } else if (type === 'speed_config') {
          // 速度配置 | 需要更新到store中
          globalStore.setSpeedConfig(_data)
        } else if (type === 'weight_config') {
          // 载重配置
          globalStore.setWeightConfig(_data)
        } else if (type === 'priority_config') {
          // 优先级配置
          globalStore.setPriorityConfig(_data)
        }
      }

      // globalStore.setReplayData(data)
    }
  })
}

//
/**
 * 查询回放文件列表
 */
const getReplayDBFileList = () => {
  queryReplayDBFileList().then((res: any) => {
    if (res.data.code === 200) {
      fileListOption.value = res.data.data
    }
  })
}

const handleChangeRate = (value: number) => {
  playbackRate.value = value
  stop()
  play()
}

/**
 * 下载指定db文件
 */
const downLoadFile = () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择要下载的文件')
    return
  }
  downloadReplayDBFile({ fileName: selectedFile.value }).then((res: any) => {
    if (res.status === 200) {
      const blob = new Blob([res.data], { type: 'application/octet-stream' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = selectedFile.value || 'replay.db'
      link.click()
      window.URL.revokeObjectURL(link.href)
    } else {
      ElMessage.error('下载失败')
    }
  })
}

/**
 * 上传指定文件
 */
const handleChange = (uploadFile: any) => {
  console.log('上传文件', uploadFile.file)
  
  // 重置上传状态
  isUploading.value = true
  uploadProgress.value = 0

  uploadReplayDBFile(uploadFile.file, (progressEvent: any) => {
    // 计算上传进度百分比
    if (progressEvent.total) {
      uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
    }
  }).then((res: any) => {
    if (res.data.code === 200) {
      ElMessage.success('上传成功')
      getReplayDBFileList()
    } else {
      ElMessage.error(res.data.message || '上传失败')
    }
  }).catch((err: any) => {
    ElMessage.error('上传失败: ' + (err.message || '网络错误'))
  }).finally(() => {
    // 上传完成，重置状态
    isUploading.value = false
    uploadProgress.value = 0
  })
}

/**
 * 监听按键 控制播放
 */
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'Space':
      event.preventDefault()
      // console.log('空格键按下')
      togglePlay()
      break
    case 'ArrowLeft':
      // console.log('左方向键按下')
      rewind(1000)
      break
    case 'ArrowRight':
      // console.log('右方向键按下')
      forward(1000)
      break
  }
}


onMounted(() => {
  // appManager.value = ApplicationManager.getInstance()
  getReplayDBFileList()
  window.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => {
  stop()
  window.removeEventListener('keydown', handleKeyDown)
})



</script>

<style scoped>
.replay-container {
  position: relative;
  width: 100%;
  height: 100%;
}
.timeline-player {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 10px;
}

.timeline {
  margin-bottom: 10px;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
:deep(.el-upload-list) {
  margin: 0;
}
</style>
