// stores/useLocalStorage.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 导出接口，供多个组件使用
export interface GlobalSettings {
    all_vpb_show: boolean  // 是否显示全部vpb
    map_show: boolean  // 是否显示地图
    background_image_show: boolean  // 是否显示背景图片
    
    vehicle_visible: Record<string, boolean>  // 车辆显示状态, key为车号, 默认为true

    vehicle_allShortPathsVisible: boolean  // 短路径显示状态

    vehicle_allLongPathsVisible: boolean   // 长路径显示状态

    vehicle_allIDsVisible: boolean          // ID显示状态
    // 轮廓相关
    vehicle_selfAreaVisible: boolean        // 车辆自身轮廓

    vehicle_gaAreasVisible: boolean         // GA

    vehicle_plaAreasVisible: boolean        // PLA

    vehicle_pgaAreasVisible: boolean        // PGA

}

// 默认值常量
export const defaultGlobalSettings: GlobalSettings = {
    all_vpb_show: false,
    map_show: true,
    background_image_show: false,
    vehicle_visible: {},
    vehicle_allShortPathsVisible: true,
    vehicle_allLongPathsVisible: true,
    vehicle_allIDsVisible: true,

    vehicle_selfAreaVisible: false,
    vehicle_gaAreasVisible: true,
    vehicle_plaAreasVisible: false,
    vehicle_pgaAreasVisible: false,
}

// localStorage 键名
const STORAGE_KEY = 'map_settings'

// 从 localStorage 获取值的辅助函数
function getStoredValue<T>(key: string, defaultValue: T): T {
    try {
        const item = localStorage.getItem(key)
        if(!item) {
            // 不存在时使用默认值
            return defaultValue
        }
        // 已存在则进行解析, 并增加新增加的默认参数
        const storedData = JSON.parse(item);
        return deepMergeWithDefault(defaultValue, storedData);
    } catch (error) {
        console.error(`Error reading localStorage key "${key}":`, error)
        return defaultValue
    }
}


// 深度合并函数，优先使用存储数据，但保留默认值中的新字段
function deepMergeWithDefault<T>(defaultValue: T, storedData: any): T {
    // 如果存储数据是 null 或 undefined，或者不是对象，返回默认值
    if (storedData == null || typeof storedData !== 'object') {
        return defaultValue;
    }
    
    // 如果默认值不是对象，或者存储数据与默认值类型不同，返回存储数据
    if (defaultValue == null || typeof defaultValue !== 'object' || 
        Array.isArray(defaultValue) !== Array.isArray(storedData)) {
        return storedData as T;
    }
    
    // 处理数组
    if (Array.isArray(defaultValue)) {
        // 如果存储的数据不是数组，返回默认值
        if (!Array.isArray(storedData)) {
            return defaultValue;
        }
        // 对于数组，我们可以选择性地合并，这里简单返回存储的数组
        // 或者你可以实现更复杂的数组合并逻辑
        return storedData as T;
    }
    
    // 处理对象
    const result: Record<string, any> = { ...storedData };
    
    // 遍历默认值的所有属性
    for (const key in defaultValue) {
        if (defaultValue.hasOwnProperty(key)) {
            // 如果存储的数据中没有这个键，使用默认值
            if (!(key in storedData)) {
                result[key] = defaultValue[key];
            } 
            // 如果存储的数据中有这个键，且都是对象，则递归合并
            else if (typeof defaultValue[key] === 'object' && defaultValue[key] !== null &&
                     typeof storedData[key] === 'object' && storedData[key] !== null) {
                result[key] = deepMergeWithDefault(defaultValue[key], storedData[key]);
            }
            // 否则保持存储数据的值
        }
    }
    
    return result as T;
}


export const useGlobalSettingsStore = defineStore('globalSettings', () => {
    // 从 localStorage 加载初始值
    const globalSettings = ref<GlobalSettings>(getStoredValue(STORAGE_KEY, defaultGlobalSettings))
    
    // 监听变化并自动保存到 localStorage
    watch(
        globalSettings,
        (newValue) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newValue))
        },
        { deep: true }
    )
    
    /**
     * 更新车辆可见性
     */
    const updateVehicleVisible = (vehicleId: string, visible: boolean): void => {
        globalSettings.value = {
            ...globalSettings.value,
            vehicle_visible: {
                ...globalSettings.value.vehicle_visible,
                [vehicleId]: visible
            }
        }
        // console.log('车辆可见性更新:', { vehicleId, visible })
    }
    
    /**
     * 更新所有车辆的可见性
     */
    const updateAllVehicleVisible = (visible: boolean): void => {
        Object.entries(globalSettings.value.vehicle_visible).forEach(([key]) => {
            globalSettings.value.vehicle_visible[key] = visible;
        });
    }


    /**
     * 获取车辆可见性（带默认值）
     */
    const getVehicleVisible = (vehicleId: string): boolean => {
        return globalSettings.value.vehicle_visible[vehicleId] ?? true
    }
    
    /**
     * 批量更新车辆可见性
     */
    const updateMultipleVehicles = (updates: Record<string, boolean>): void => {
        globalSettings.value = {
            ...globalSettings.value,
            vehicle_visible: {
                ...globalSettings.value.vehicle_visible,
                ...updates
            }
        }
    }
    
    /**
     * 初始化车辆可见性（如果不存在）
     */
    const initVehicleVisible = (vehicleId: string, defaultValue: boolean = true): void => {
        if (globalSettings.value.vehicle_visible[vehicleId] === undefined) {
            updateVehicleVisible(vehicleId, defaultValue)
        }
    }
    
    /**
     * 切换车辆可见性
     */
    const toggleVehicleVisible = (vehicleId: string): void => {
        const current = getVehicleVisible(vehicleId)
        updateVehicleVisible(vehicleId, !current)
    }
    
    /**
     * 重置所有设置为默认值
     */
    const resetToDefault = (): void => {
        globalSettings.value = { ...defaultGlobalSettings }
    }
    
    /**
     * 更新所有设置
     */
    const updateAllSettings = (newSettings: Partial<GlobalSettings>): void => {
        globalSettings.value = {
            ...globalSettings.value,
            ...newSettings,
            // 特别处理 vehicle_visible，需要合并而不是替换
            vehicle_visible: newSettings.vehicle_visible 
                ? {
                    ...globalSettings.value.vehicle_visible,
                    ...newSettings.vehicle_visible
                  }
                : globalSettings.value.vehicle_visible
        }
    }
    
    return {
        // 状态
        globalSettings,
        
        // 操作方法
        updateVehicleVisible,
        getVehicleVisible,
        updateMultipleVehicles,
        initVehicleVisible,
        toggleVehicleVisible,
        resetToDefault,
        updateAllSettings,
        updateAllVehicleVisible
    }
})