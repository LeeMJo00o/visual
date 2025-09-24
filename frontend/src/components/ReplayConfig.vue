<template>
  <div class="timeline-player">
    <!-- 时间轴 -->
    <div class="timeline">
      <el-slider
        v-model="currentPercent"
        :min="0"
        :max="100"
        @change="handleSeek"
        :disabled="!isReplay"
        style="width: 100%"
      />
      <div class="time-labels">
        <span>{{ formatTime(startTime) }}</span>
        <!-- 控制区 -->
        <div class="controls">
          <el-switch
            v-model="isReplay"
            class="ml-2"
            inline-prompt
            style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
            active-text="回放开启"
            inactive-text="回放禁用"
            @change="handleChangeIsReplay"
          />
          <el-select
            v-model="selectedFile"
            :disabled="!isReplay"
            @change="handleFileChange"
            placeholder="Please select"
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
            :disabled="!isReplay"
            action="#"
            :show-file-list="false"
            :http-request="handleChange"
          >
            <el-button :disabled="!isReplay">Upload DB File</el-button>
          </el-upload>

          <el-tooltip class="box-item" content="重置">
            <el-button :disabled="!isReplay" @click="reset" size="small" circle>
              <el-icon><Refresh /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip class="box-item" content="后退5秒">
            <el-button :disabled="!isReplay" @click="rewind" size="small" circle>
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
            <el-button :disabled="!isReplay" @click="forward" size="small" circle>
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  queryReplayDBFileList,
  queryReplayTimeRange,
  queryReplayRangeData,
  queryReplayData,
  downloadReplayDBFile,
  uploadReplayDBFile,
} from '@/api/index.js'
import { ElMessage } from 'element-plus'
import type { UploadProps, UploadUserFile } from 'element-plus'
import { Refresh, ArrowLeft, ArrowRight, VideoPlay, VideoPause } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { PosUpdateData, LockAreaUpdateData, PathUpdateData } from '@/routing_map/types'
import ApplicationManager from '@/routing_map/main'

import { useGlobalStore } from '@/stores/globalStore'

const globalStore = useGlobalStore()

// const appManager = ref<ApplicationManager | null>(null)
// const appManager = ApplicationManager.getInstance()
const appManager = ApplicationManager.getInstance()

const isReplay = ref<boolean>(false)

watch(
  () => globalStore.isReplay,
  (newVal) => {
    isReplay.value = newVal
  },
  { immediate: true },
)

const startTime = ref<number>(0)
const endTime = ref<number>(0)

// 当前播放状态
const isPlaying = ref(false)
const currentTime = ref<number>(0) // 毫秒
const currentPercent = ref(0)
const timer = ref<number | null>(null)

// 播放速度
const playbackRate = ref(1)
const speedOptions = ref([0.5, 1, 2, 4])

const fileListOption = ref([])

const selectedFile = ref('')

// 时间格式化
const formatTime = (time: number) => {
  if (!time) return '00:00:00'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 播放/暂停
const togglePlay = () => {
  if (isPlaying.value) {
    stop()
  } else {
    play()
  }
}

const play = () => {
  isPlaying.value = true
  timer.value = window.setInterval(() => {
    currentTime.value += 1000 * playbackRate.value
    if (currentTime.value >= endTime.value) {
      currentTime.value = endTime.value
      stop()
      ElMessage.success('播放完成')
    } else {
      getReplayRangeData()
    }

    updatePercent()
  }, 1000)
}

const stop = () => {
  isPlaying.value = false
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

const handleChangeIsReplay = () => {
  globalStore.setIsReplay(!globalStore.isReplay)
}

// 拖动/点击时间轴
const handleSeek = (val: number) => {
  const duration = endTime.value - startTime.value
  currentTime.value = Math.floor((startTime.value + (val / 100) * duration) / 1000) * 1000
  getReplayRangeData()
}

// 更新百分比
const updatePercent = () => {
  const duration = endTime.value - startTime.value
  currentPercent.value = ((currentTime.value - startTime.value) / duration) * 100
}

// 前进后退
const forward = () => {
  currentTime.value = Math.min(endTime.value, currentTime.value + 5000)
  updatePercent()
}
const rewind = () => {
  currentTime.value = Math.max(startTime.value, currentTime.value - 5000)
  updatePercent()
}

// 重置
const reset = () => {
  stop()
  currentTime.value = startTime.value
  updatePercent()
}

/**
 * 查询当前文件的使劲按范围
 */
const handleFileChange = (value: string) => {
  queryReplayTimeRange({ fileName: value }).then((res) => {
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
  queryReplayData({ fileName: selectedFile.value, t: _startTime }).then((res) => {
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
        } else if (type === 'polygon' && subtype === 'selfarea') {
          // 多边形
        } else if (type === 'polygon' && subtype === 'ga') {
          // GA
        } else if (type === 'polygon' && subtype === 'pga') {
          // pga
        } else if (type === 'polygon' && subtype === 'pla') {
          // pla
        } else if (type === 'long' || type === 'short') {
          // 长路径数据 | 短路径数据
          appManager?.dataRenderer?.demo_update_path(data[i] as PathUpdateData)
        } else if (type === 'speed_config') {
          console.log('speed config data: ', _data)

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

/**
 * 查询回放文件列表
 */
const getReplayDBFileList = () => {
  queryReplayDBFileList().then((res) => {
    if (res.data.code === 200) {
      fileListOption.value = res.data.data
    }
  })
}

const handleChangeRate = (value: number) => {
  playbackRate.value = value
}

/**
 * 下载指定db文件
 */
const downLoadFile = () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择要下载的文件')
    return
  }
  downloadReplayDBFile({ fileName: selectedFile.value }).then((res) => {
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
  // debugger

  uploadReplayDBFile(uploadFile.file).then((res) => {
    if (res.data.code === 200) {
      ElMessage.success('上传成功')
      getReplayDBFileList()
    } else {
      ElMessage.error(res.data.message || '上传失败')
    }
  })
  // fileList.value = fileList.value.slice(-3)
}
watch(currentTime, updatePercent)

onMounted(() => {
  // appManager.value = ApplicationManager.getInstance()
  getReplayDBFileList()
})
onUnmounted(() => {
  stop()
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
/deep/ .el-upload-list {
  margin: 0;
}
</style>
