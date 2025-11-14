// composables/useLocalStorage.ts
import { ref, watch } from 'vue'

// 导出接口，供多个组件使用
export interface MapSettings {
    all_vpb_show: boolean  // 是否显示全部vpb
}

// 默认值常量
export const defaultMapSettings: MapSettings = {
    all_vpb_show: false
}

export function useLocalStorage<T>(key: string, defaultValue: T) {
    // 从 localStorage 读取数据
    const data = ref<T>(getStoredValue(key, defaultValue))
    
    // 监听数据变化，自动保存到 localStorage
    watch(data, (newValue) => {
        localStorage.setItem(key, JSON.stringify(newValue))
    }, { deep: true })
    
    return data
}

// 从 localStorage 获取值的辅助函数
function getStoredValue<T>(key: string, defaultValue: T): T {
    try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultValue
    } catch (error) {
        console.error(`Error reading localStorage key "${key}":`, error)
        return defaultValue
    }
}


// 专门针对 MapSettings 的快捷 Hook
export function useMapSettings() {
    return useLocalStorage<MapSettings>('user_settings', defaultMapSettings)
}