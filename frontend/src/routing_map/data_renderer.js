import { WebSocketClient } from './pp_backend.js'

/**
 * 数据渲染管理器
 * 负责处理WebSocket数据接收和图形绘制
 */
export class DataRenderer {
  /**
   * @param {any} manager - ApplicationManager实例
   */
  constructor(manager) {
    this.manager = manager
    this.websocket_clients = {}
    this.long_path_width = 1
    this.short_path_width = 4
  }

  /**
   * 初始化WebSocket连接
   * @param {string} mode - 运行模式 ('test-demo' 或 'production')
   */
  init_websockets(mode) {
    this._init_demo_websockets()
  }
  /**
   * 初始化demo模式的WebSocket连接
   */
  _init_demo_websockets() {
    const ws_prefix = `ws://${window.location.hostname}:${window.location.port}`

    // 长路径WebSocket
    const ws_long = new WebSocketClient(`${ws_prefix}/api/ws/demo/demo_path`, {
      onMessage: (data) => {
        this.demo_update_path_long(data)
      },
    })
    ws_long.connect()
    this.websocket_clients['demo_long_path'] = ws_long

    // 短路径WebSocket
    const ws_short = new WebSocketClient(`${ws_prefix}/api/ws/demo/demo_short_path`, {
      onMessage: (data) => {
        this.demo_update_path_short(data)
      },
    })
    ws_short.connect()
    this.websocket_clients['demo_short_path'] = ws_short

    // 位置信息WebSocket
    const ws_pose = new WebSocketClient(`${ws_prefix}/api/ws/demo/pose_info`, {
      onMessage: (data) => {
        this.pose_update(data)
      },
    })
    ws_pose.connect()
    this.websocket_clients['demo_pose'] = ws_pose

    // 锁闭区WebSocket
    const ws_areas = new WebSocketClient(`${ws_prefix}/api/ws/demo/lock_area`, {
      onMessage: (data) => {
        this.areas_update(data)
      },
    })
    ws_areas.connect()
    this.websocket_clients['demo_areas'] = ws_areas

    // 设置路径宽度
    this.long_path_width = 1
    this.short_path_width = 4
  }

  /**
   * 关闭所有WebSocket连接
   */
  close_all_websockets() {
    Object.values(this.websocket_clients).forEach((client) => {
      if (client && typeof client.close === 'function') {
        client.close()
      }
    })
    this.websocket_clients = {}
  }

  /**
   * 更新长路径
   * @param {Object} data - 路径数据
   * @param {number} width - 路径宽度
   */
  demo_update_path_long(data) {
    for (const [vehicleId, v] of Object.entries(data.data)) {
      if (v === null) {
        if (this.manager.agents[vehicleId]) {
          this.manager.agents[vehicleId].graph_long_path.clear()
        }
        return
      }

      const path_t = this.demo_path_to_my(v)

      if (!this.manager.agents.hasOwnProperty(vehicleId)) {
        this.manager.add_agent(vehicleId, 9999, 9999, 0)
      }

      this.manager.agents[vehicleId].graph_long_path.clear()
      this.manager.drawLine(
        this.manager.agents[vehicleId].graph_long_path,
        vehicleId,
        path_t,
        false,
        this.manager.agents[vehicleId].color,
        this.long_path_width,
        1,
      )
    }
  }

  /**
   * 更新短路径
   * @param {Object} data - 路径数据
   * @param {number} width - 路径宽度
   */
  demo_update_path_short(data, width) {
    for (const [vehicleId, v] of Object.entries(data.data)) {
      if (v === null) {
        if (this.manager.agents[vehicleId]) {
          this.manager.agents[vehicleId].graph_short_path.clear()
        }
        return
      }

      const path_t = this.demo_path_to_my(v)

      if (!this.manager.agents.hasOwnProperty(vehicleId)) {
        this.manager.add_agent(vehicleId, 9999, 9999, 0)
      }

      this.manager.agents[vehicleId].graph_short_path.clear()
      this.manager.drawLine(
        this.manager.agents[vehicleId].graph_short_path,
        vehicleId,
        path_t,
        false,
        this.manager.agents[vehicleId].color,
        this.short_path_width,
        0.5,
      )
    }
  }

  /**
   * 处理位置信息更新
   * @param {Object} data - 位置数据
   */
  pose_update(data) {
    for (const [id, v] of Object.entries(data.data)) {
      // 如果禁用了平滑移动，则为每个Agent重置设置
      if (!this.manager.smoothMovementConfig.enabled && this.manager.agents[id]) {
        this.manager.agents[id].isAnimating = false
      }

      this.draw_one_agent({
        vehicleId: id,
        x: v.x,
        y: v.y,
        theta: v.yaw,
      })
    }
  }

  /**
   * 处理锁闭区数据更新
   * @param {Object} data - 锁闭区数据
   */
  async areas_update(data) {
    const all_areas = data.data
    console.log('收到锁闭区数据:', Object.keys(all_areas).length, '个区域')

    // 清除之前的锁定区域显示
    if (this.manager.graphics_lock_area) {
      this.manager.graphics_lock_area.clear()
    }

    // 清理所有现有的锁闭区图形对象
    Object.values(this.manager.lockAreas).forEach((areaGraphics) => {
      if (areaGraphics && areaGraphics.parent) {
        areaGraphics.parent.removeChild(areaGraphics)
      }
    })
    this.manager.lockAreas = {}

    // 绘制所有锁定区域
    for (const [areaId, area] of Object.entries(all_areas)) {
      await this.draw_lock_area(areaId, area)
    }

    console.log('锁闭区更新完成，总共绘制了', Object.keys(this.manager.lockAreas).length, '个区域')
  }

  /**
   * 绘制单个锁闭区
   * @param {string} areaId - 区域ID
   * @param {Object} area - 区域数据
   */
  async draw_lock_area(areaId, area) {
    if (!area.polygon || area.polygon.length < 3) {
      console.log('跳过无效的锁闭区:', areaId, area)
      return
    }

    console.log('绘制锁闭区:', areaId, area.name)

    // 为每个锁闭区创建独立的图形对象
    const { Graphics } = await import('pixi.js')
    const areaGraphics = new Graphics()

    // 将多边形数据转换为drawLine需要的格式
    const points = area.polygon.map((point) => [point.x, point.y])

    // 使用drawLine方法绘制锁闭区
    this.manager.drawLine(
      areaGraphics,
      areaId,
      points,
      true, // 使用虚线
      '#ff0000', // 红色边框
      1, // 线宽
      1, // 透明度
    )

    // 设置交互属性
    areaGraphics.interactive = true
    areaGraphics.cursor = 'pointer'

    // 保存区域数据到图形对象
    areaGraphics.areaData = area
    areaGraphics.areaId = areaId

    // 添加鼠标悬停事件处理，显示锁闭区信息
    areaGraphics.on('pointerover', (e) => {
      console.log('鼠标悬停在锁闭区上:', areaId)

      // 高亮显示锁闭区
      areaGraphics.tint = 0xffff00 // 黄色高亮

      // 创建tooltip内容
      const tooltipContent = `
        <div style="font-weight: bold; margin-bottom: 4px;">Area Detail</div>
        <div>name: ${area.name || areaId}</div>
        <div>type: ${area.type || 'lock'}</div>
        <div>sub-type: ${area.subtype || 'lock'}</div>
        <div>create_by: ${area.created_by || 'unknown'}</div>
        <div>desc: ${area.describe || '无'}</div>
      `

      // 显示tooltip
      if (this.manager.tooltip) {
        this.manager.tooltip.innerHTML = tooltipContent
        this.manager.tooltip.style.display = 'block'
        this.manager.tooltip.style.left = e.clientX + 15 + 'px'
        this.manager.tooltip.style.top = e.clientY + 10 + 'px'

        // 跟随鼠标移动
        const onMouseMove = (moveEvent) => {
          this.manager.tooltip.style.left = moveEvent.clientX + 15 + 'px'
          this.manager.tooltip.style.top = moveEvent.clientY + 10 + 'px'
        }

        // 鼠标离开时移除事件监听
        const onPointerOut = () => {
          console.log('鼠标离开锁闭区:', areaId)
          document.removeEventListener('mousemove', onMouseMove)
          this.manager.tooltip.style.display = 'none'
          areaGraphics.tint = 0xffffff // 恢复正常颜色
          // 移除pointerout事件监听器，避免重复绑定
          areaGraphics.off('pointerout', onPointerOut)
        }

        document.addEventListener('mousemove', onMouseMove)
        areaGraphics.on('pointerout', onPointerOut)
      }
    })

    // 将图形对象添加到主容器
    this.manager.mainContainer.addChild(areaGraphics)

    // 存储到锁闭区对象中
    this.manager.lockAreas[areaId] = areaGraphics

    console.log('锁闭区绘制完成:', areaId, '总数:', Object.keys(this.manager.lockAreas).length)
  }

  /**
   * 绘制单个车辆
   * @param {Object} data - 车辆数据
   */
  draw_one_agent(data) {
    const { vehicleId, x, y, theta } = data
    if (this.manager.agents.hasOwnProperty(vehicleId)) {
      this.manager.agents[vehicleId].setPosition(x, -y, theta)
    } else {
      this.manager.add_agent(vehicleId, x, -y, theta)
    }
  }

  /**
   * 将demo路径数据转换为内部格式
   * @param {Object} path - 路径数据
   * @returns {Array} 转换后的路径点数组
   */
  demo_path_to_my(path) {
    // 缓存频繁访问的属性
    const pathArray = path.path
    const pathLength = pathArray.length
    const startPose = path.start_pose
    const endPose = path.end_pose
    const mapPathInfo = this.manager.map_path_info

    // 预分配数组大小以提高性能
    let path_t = []
    path_t.push([startPose.x, startPose.y])

    // 计算起始和结束索引
    let start_index = startPose.index
    if (!startPose.is_ahead) {
      start_index += 1
    }

    let end_index = endPose.index
    if (endPose.is_ahead) {
      end_index -= 1
    }

    // 处理路径段
    if (pathLength === 1) {
      // 单路径段：只添加中间部分
      if (start_index < end_index) {
        const startLltId = pathArray[0]
        const pathInfo = mapPathInfo[startLltId]
        if (pathInfo && Array.isArray(pathInfo.points)) {
          path_t.push(...pathInfo.points.slice(start_index, end_index))
        }
      }
    } else {
      // 多路径段：添加起始段、中间段、结束段
      const startLltId = pathArray[0]
      const endLltId = pathArray[pathLength - 1]

      // 处理起始段
      const startPathInfo = mapPathInfo[startLltId]
      if (startPathInfo && Array.isArray(startPathInfo.points)) {
        path_t.push(...startPathInfo.points.slice(start_index))
      }

      // 处理中间段 - 优化循环
      for (let i = 1; i < pathLength - 1; i++) {
        const lltId = pathArray[i]
        const pathInfo = mapPathInfo[lltId]
        if (pathInfo && Array.isArray(pathInfo.points)) {
          path_t.push(...pathInfo.points)
        }
      }

      // 处理结束段
      const endPathInfo = mapPathInfo[endLltId]
      if (endPathInfo && Array.isArray(endPathInfo.points)) {
        path_t.push(...endPathInfo.points.slice(0, end_index))
      }
    }

    // 添加结束点
    path_t.push([endPose.x, endPose.y])
    return path_t
  }
}
