import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import ApplicationManager from '@/routing_map/main'


export const useDynamicVpbStore = defineStore('dynamicVpbStore', () => {
    const version = ref(null)
    const data = ref(null)
    // 轮询间隔（毫秒）
    const POLL_INTERVAL = 5000                                      // 轮询检测间隔
    let pollInterval: ReturnType<typeof setInterval> | null = null  // 轮询定时器
    const isPollingActive = ref(false)                              // 是否正在轮询

    // 私有实例变量，用于跟踪是否已初始化
    let _initialized = false

    // const appManager = ApplicationManager.getInstance()


    // 获取版本号
    const fetchVersion = async () => {
        try {
            const response = await axios.get('/api/dynamic/vpb/query/last/version')
            return response.data.data
        } catch (err) {
            console.error('轮询请求失败:', err)
        } finally {
        }
        return ""
    }

    // 获取数据
    const fetchData = async () => {
        try {
            const response = await axios.get('/api/dynamic/vpb/query/data')
            return response.data.data
        } catch (err) {
            console.error('轮询请求失败:', err)
        } finally {
        }
        return null
    }

    // 检查版本号, 若是发生变化, 则重新获取数据
    const check = async () => {
        const _version = await fetchVersion()
        if (_version && _version != version.value) {
            console.log('动态vpb, 有新版本, 重新获取数据, new version:', _version)
            // 有新版本, 重新获取数据
            const _data = await fetchData()
            console.log("动态vpb数据: ", _data)
            if (_data) {
                version.value = _data?.version
                data.value = _data?.data
            }
        }
        // 进行更新 - 确保 ApplicationManager 已完全初始化
        try {
            const appManager = ApplicationManager.getInstance()
            if (appManager?.app?.canvas && appManager?.dataRenderer) {
                appManager.dataRenderer.update_dynamic_vpb(data.value)
            }
        } catch (e) {
            // ApplicationManager 尚未初始化完成，跳过本次更新
            console.log('ApplicationManager 尚未就绪，跳过动态 vpb 更新')
        }
    }

    const startPolling = () => {
        // 防止多个组件同时调用时重复启动
        if (isPollingActive.value) {
            console.log('轮询已在运行中')
            return
        }

        console.log('🚀 启动动态 vpb 轮询服务')
        isPollingActive.value = true

        // 立即获取一次
        check()

        // 设置定时器
        pollInterval = setInterval(check, POLL_INTERVAL)
    }

    const stopPolling = () => {
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
            isPollingActive.value = false
            console.log('🛑 停止轮询服务')
        }
    }

    // 自动初始化（但只执行一次）
    if (!_initialized && typeof window !== 'undefined') {
        _initialized = true
        // 可以在这里自动启动，或者由组件控制
        startPolling()
    }


    return {
        // 状态
        version,
        data,
        isPollingActive,

        // 方法
        fetchData,
        startPolling,
        stopPolling,
    }
})