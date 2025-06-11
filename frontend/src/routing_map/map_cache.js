// 地图数据缓存管理模块
class MapCache {
    constructor() {
        this.db = null
        this.version = null
        this.initDB()
    }

    // 初始化 IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MapCacheDB', 1)

            request.onerror = () => {
                console.error('打开数据库失败')
                reject(request.error)
            }

            request.onsuccess = (event) => {
                this.db = event.target.result
                console.log('数据库连接成功')
                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = event.target.result
                if (!db.objectStoreNames.contains('mapData')) {
                    const store = db.createObjectStore('mapData', { keyPath: 'id' })
                    store.createIndex('version', 'version', { unique: false })
                }
            }
        })
    }

    // 设置当前地图版本
    setVersion(version) {
        this.version = version
    }

    // 生成缓存键
    generateCacheKey(type) {
        if (!this.version) return null
        return `map_${type}_v${this.version}`
    }

    // 获取缓存数据
    async get(type) {
        if (!this.version || !this.db) return null

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['mapData'], 'readonly')
            const store = transaction.objectStore('mapData')
            const cacheKey = this.generateCacheKey(type)
            if (!cacheKey) {
                resolve(null)
                return
            }

            const request = store.get(cacheKey)

            request.onsuccess = () => {
                if (request.result) {
                    console.log(`从缓存获取${type}数据成功`)
                    resolve(request.result.data)
                } else {
                    console.log(`缓存中没有${type}数据`)
                    resolve(null)
                }
            }

            request.onerror = () => {
                console.error(`获取${type}缓存数据失败:`, request.error)
                resolve(null)
            }
        })
    }

    // 保存数据到缓存
    async save(type, data) {
        if (!this.version || !this.db) return

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['mapData'], 'readwrite')
            const store = transaction.objectStore('mapData')
            const cacheKey = this.generateCacheKey(type)
            if (!cacheKey) {
                resolve()
                return
            }

            const item = {
                id: cacheKey,
                version: this.version,
                type: type,
                data: data,
                timestamp: Date.now()
            }

            const request = store.put(item)

            request.onsuccess = () => {
                console.log(`保存${type}数据到缓存成功`)
                resolve()
            }

            request.onerror = () => {
                console.error(`保存${type}数据到缓存失败:`, request.error)
                reject(request.error)
            }
        })
    }

    // 清理旧版本缓存
    async clearOldCache() {
        if (!this.version || !this.db) return

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['mapData'], 'readwrite')
            const store = transaction.objectStore('mapData')
            const index = store.index('version')

            const request = index.openCursor()

            request.onsuccess = (event) => {
                const cursor = event.target.result
                if (cursor) {
                    if (cursor.value.version !== this.version) {
                        cursor.delete()
                    }
                    cursor.continue()
                } else {
                    console.log('清理旧版本缓存完成')
                    resolve()
                }
            }

            request.onerror = () => {
                console.error('清理旧版本缓存失败:', request.error)
                reject(request.error)
            }
        })
    }

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close()
            this.db = null
        }
    }
}

// 导出单例
export const mapCache = new MapCache()
