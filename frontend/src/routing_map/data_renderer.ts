import { WebSocketClient } from './pp_backend.js'
import { Graphics } from 'pixi.js'
import ApplicationManager from './main.ts'

// 类型定义
interface Position {
  x: number
  y: number
  theta: number
}

interface AgentData {
  vehicleId: string
  x: number
  y: number
  theta: number
  block: string
  blocked_by: string
}

interface OneLane {
  lane_id: string
  lcp_point?: {
    x: number
    y: number
  }
}

interface PathData {
  path: OneLane[]
  start_pose: {
    x: number
    y: number
    index: number
    is_ahead: boolean
  }
  end_pose: {
    x: number
    y: number
    index: number
    is_ahead: boolean
  }
}

interface PathUpdateData {
  data: Record<string, PathData | null>
}

interface PoseData {
  x: number
  y: number
  yaw: number
}

interface PoseUpdateData {
  data: Record<string, PoseData>
}

interface LockArea {
  name?: string
  type?: string
  subtype?: string
  created_by?: string
  describe?: string
  polygon: Array<{ x: number; y: number }>
}

interface LockAreaUpdateData {
  data: Record<string, LockArea>
}

interface WebSocketClients {
  [key: string]: WebSocketClient
}

interface LockAreas {
  [key: string]: Graphics
}

/**
 * 数据渲染管理器
 * 负责处理WebSocket数据接收和图形绘制
 */
export class DataRenderer {
  private manager: ApplicationManager
  private websocket_clients: WebSocketClients
  private long_path_width: number
  private short_path_width: number

  /**
   * @param manager - ApplicationManager实例
   */
  constructor(manager: ApplicationManager) {
    this.manager = manager
    this.websocket_clients = {}
    this.long_path_width = 1
    this.short_path_width = 4
  }

  /**
   * 初始化WebSocket连接
   * @param mode - 运行模式 ('test-demo' 或 'production')
   */
  init_websockets(mode: string): void {
    this._init_demo_websockets()
  }

  /**
   * 初始化demo模式的WebSocket连接
   */
  private _init_demo_websockets(): void {
    const ws_prefix = `ws://${window.location.hostname}:${window.location.port}`

    const ws_path = new WebSocketClient(`${ws_prefix}/api/ws/demo/path`, {
      onMessage: (data: PathUpdateData) => {
        this.demo_update_path(data)
      },
    })

    ws_path.connect()
    this.websocket_clients['demo_path'] = ws_path

    // 位置信息WebSocket
    const ws_pose = new WebSocketClient(`${ws_prefix}/api/ws/demo/pose_info`, {
      onMessage: (data: PoseUpdateData) => {
        this.pose_update(data)
      },
    })
    ws_pose.connect()
    this.websocket_clients['demo_pose'] = ws_pose

    // 锁闭区WebSocket
    const ws_areas = new WebSocketClient(`${ws_prefix}/api/ws/demo/lock_area`, {
      onMessage: (data: LockAreaUpdateData) => {
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
  close_all_websockets(): void {
    Object.values(this.websocket_clients).forEach((client) => {
      if (client && typeof client.close === 'function') {
        client.close()
      }
    })
    this.websocket_clients = {}
  }

  demo_update_path(data) {
    let path_type = data['type']
    if (path_type == 'reload_window') {
      // reload all window
      window.location.reload()
      return
    }
    for (const [vehicleId, v] of Object.entries(data.data)) {
      if (!this.manager.agents.hasOwnProperty(vehicleId)) {
        this.manager.add_agent(vehicleId)
      }
      let g = null
      let path_width = null
      let alpha = null
      let vehicle = this.manager.agents[vehicleId]
      if (path_type == 'short') {
        g = vehicle.graph_short_path
        path_width = this.short_path_width
        alpha = 0.5
      } else if (path_type == 'long') {
        g = vehicle.graph_long_path
        path_width = this.long_path_width
        alpha = 1
      } else {
      }
      g.clear()
      if (v.path === null) {
        return
      }
      const all_path_t = this.demo_path_to_my(v)
      for (const a_road_path of all_path_t) {
        this.manager.drawLine(g, vehicleId, a_road_path, false, vehicle.color, path_width, alpha)
      }
    }
  }

  /**
   * 处理位置信息更新
   * @param data - 位置数据
   */
  pose_update(data: PoseUpdateData): void {
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
        tx: v.tx,
        ty: v.ty,
        t_theta: v.tyaw,
        block: v.block,
        blocked_by: v.blocked_by,
      })
    }
  }

  /**
   * 处理锁闭区数据更新
   * @param data - 锁闭区数据
   */
  async areas_update(data: LockAreaUpdateData): Promise<void> {
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
   * @param areaId - 区域ID
   * @param area - 区域数据
   */
  private async draw_lock_area(areaId: string, area: LockArea): Promise<void> {
    if (!area.polygon || area.polygon.length < 3) {
      console.log('跳过无效的锁闭区:', areaId, area)
      return
    }

    console.log('绘制锁闭区:', areaId, area.name)

    // 为每个锁闭区创建独立的图形对象
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
    ;(areaGraphics as any).areaData = area
    ;(areaGraphics as any).areaId = areaId

    // 添加鼠标悬停事件处理，显示锁闭区信息
    areaGraphics.on('pointerover', (e: any) => {
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
        const onMouseMove = (moveEvent: MouseEvent) => {
          if (this.manager.tooltip) {
            this.manager.tooltip.style.left = moveEvent.clientX + 15 + 'px'
            this.manager.tooltip.style.top = moveEvent.clientY + 10 + 'px'
          }
        }

        // 鼠标离开时移除事件监听
        const onPointerOut = () => {
          console.log('鼠标离开锁闭区:', areaId)
          document.removeEventListener('mousemove', onMouseMove)
          if (this.manager.tooltip) {
            this.manager.tooltip.style.display = 'none'
          }
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
   * @param data - 车辆数据
   */
  draw_one_agent(data: AgentData): void {
    const { vehicleId, x, y, theta, tx, ty, t_theta } = data
    if (!this.manager.agents.hasOwnProperty(vehicleId)) {
      this.manager.add_agent(vehicleId, x, -y, theta, theta, tx, -ty, t_theta)
    }
    this.manager.agents[vehicleId].setPosition(x, -y, theta, tx, -ty, t_theta)
    this.manager.agents[vehicleId].v_info.block = data.block
    this.manager.agents[vehicleId].v_info.blocked_by = data.blocked_by
  }

  private demo_path_to_my(path: PathData): number[][] {
    const pathArray = path.path
    const pathLength = pathArray.length
    const startPose = path.start_pose
    const endPose = path.end_pose
    const mapPathInfo = this.manager.map_path_info

    // 计算起始和结束索引
    let start_index = startPose.index
    if (!startPose.is_ahead) {
      start_index += 1
    }

    let end_index = endPose.index
    if (endPose.is_ahead) {
      end_index -= 1
    }

    const all_path_t: number[][][] = []
    for (let i = 0; i < pathLength; i++) {
      const path_t: number[][] = []
      const node = pathArray[i]
      const llt_id = node['lane_id']
      const the_road_path = mapPathInfo[llt_id]
      if (i == 0) {
        path_t.push([startPose.x, startPose.y])
        if (pathLength > 1) {
          if (node.hasOwnProperty("lcp_point")){
            // path_t.push(the_road_path.points[start_index])
            path_t.push([node["lcp_point"]["x"], node["lcp_point"]["y"]])
          }else{
            path_t.push(...the_road_path.points.slice(start_index))
          }
        } else {
          path_t.push(...the_road_path.points.slice(start_index, end_index))
          path_t.push([endPose.x, endPose.y])
        }

      } else if (i == pathLength - 1) {
        path_t.push(...the_road_path.points.slice(0, 1))
        path_t.push(...the_road_path.points.slice(1, end_index))
        path_t.push([endPose.x, endPose.y])
      } else {
        if (node.hasOwnProperty("lcp_point")){
          path_t.push(the_road_path.points[0])
          path_t.push([node["lcp_point"]["x"], node["lcp_point"]["y"]])
        }else{
          path_t.push(...the_road_path.points)
        }
      }
      all_path_t.push(path_t)
    }
    return all_path_t
  }
}
