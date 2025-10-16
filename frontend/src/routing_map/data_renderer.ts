import { WebSocketClient } from './pp_backend.js'
import { Graphics } from 'pixi.js'
import ApplicationManager from './main.ts'
import { PointProjection, type Point } from './project.ts'
import { getBorderColor, getFillColor } from '@/colors/lockarea_color.ts'
import { usePriorityStore } from '@/stores/priority.ts'
import { parseWKT } from '@/util/index.ts'

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
  task: object | null
  device_mode: string | null
  priority?: number
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
  }
  end_pose: {
    x: number
    y: number
  }
}

interface PathUpdateData {
  data: Record<string, PathData | null>
}

interface PoseData {
  x: number
  y: number
  yaw: number
  priority?: number
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
  limit?: number
  fms?: boolean
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

  private priorityStore = usePriorityStore()

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
        if (this.manager.isSuspend) return
        this.demo_update_path(data)
      },
    })

    ws_path.connect()
    this.websocket_clients['demo_path'] = ws_path

    // 多边形锁闭区
    const ws_self_area = new WebSocketClient(`${ws_prefix}/api/ws/demo/self_area`, {
      onMessage: (data: any) => {
        if (this.manager.isSuspend) return
        this.demo_update_polygon({
          data: data.data,
          type: data.subtype,
          subtype: data.subtype,
        })
      },
    })
    ws_self_area.connect()
    this.websocket_clients['demo_self_area'] = ws_self_area

    const ws_ga = new WebSocketClient(`${ws_prefix}/api/ws/demo/ga`, {
      onMessage: (data: any) => {
        if (this.manager.isSuspend) return
        this.demo_update_polygon({
          data: data.data,
          type: data.subtype,
          subtype: data.subtype,
        })
      },
    })
    ws_ga.connect()
    this.websocket_clients['demo_ga'] = ws_ga

    const ws_pga = new WebSocketClient(`${ws_prefix}/api/ws/demo/pga`, {
      onMessage: (data: any) => {
        if (this.manager.isSuspend) return

        this.demo_update_polygon({
          data: data.data,
          type: data.subtype,
          subtype: data.subtype,
        })
      },
    })
    ws_pga.connect()
    this.websocket_clients['demo_pga'] = ws_pga

    const ws_pla = new WebSocketClient(`${ws_prefix}/api/ws/demo/pla`, {
      onMessage: (data: any) => {
        if (this.manager.isSuspend) return
        // console.log('ws_pla', data)
        this.demo_update_polygon({
          data: data.data,
          type: data.subtype,
          subtype: data.subtype,
        })
      },
    })
    ws_pla.connect()
    this.websocket_clients['demo_pla'] = ws_pla

    // 位置信息WebSocket
    const ws_pose = new WebSocketClient(`${ws_prefix}/api/ws/demo/pose_info`, {
      onMessage: (data: PoseUpdateData) => {
        if (this.manager.isSuspend) return
        // console.log('ws_pose')
        this.pose_update(data)
      },
    })
    ws_pose.connect()
    this.websocket_clients['demo_pose'] = ws_pose

    // 锁闭区WebSocket
    const ws_areas = new WebSocketClient(`${ws_prefix}/api/ws/demo/lock_area`, {
      onMessage: (data: LockAreaUpdateData) => {
        if (this.manager.isSuspend) return
        // console.log('ws_areas')
        this.areas_update(data, 'lock')
      },
    })
    ws_areas.connect()
    this.websocket_clients['demo_areas'] = ws_areas

    // 流量控制区域WebSocket
    const ws_limit_areas = new WebSocketClient(`${ws_prefix}/api/ws/demo/limit_area`, {
      onMessage: (data: LockAreaUpdateData) => {
        if (this.manager.isSuspend) return
        // console.log('ws_limit_areas')
        this.areas_update(data, 'limit')
      },
    })
    ws_limit_areas.connect()
    this.websocket_clients['demo_areas_limit'] = ws_limit_areas

    // 电子围栏区域WebSocket
    const ws_trigger_areas = new WebSocketClient(`${ws_prefix}/api/ws/demo/trigger_area`, {
      onMessage: (data: LockAreaUpdateData) => {
        if (this.manager.isSuspend) return
        // console.log('ws_trigger_areas')
        this.areas_update(data, 'trigger')
      },
    })
    ws_trigger_areas.connect()
    this.websocket_clients['demo_areas_trigger'] = ws_trigger_areas

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
  /**
   *
   * @param param
   * @param param.data 当前的多边形数据,对象类型
   * @param param.type
   * @param param.subtype
   */
  demo_update_polygon({ data, type, subtype }: any) {
    const entriesArray = Object.entries(data).map((e) => {
      return {
        areaId: e[0],
        area: {
          name: e[0],
          type,
          subtype,
          polygon: parseWKT(e[1] as string).coordinates.map((e) => ({ x: e[0], y: e[1] })),
        },
      }
    })

    const data_key = this.get_data_key(subtype)

    // 获取现有的区域ID集合
    const existingAreaIds = new Set(Object.keys(this.manager[data_key] || {}))

    const newAreaIds = new Set(Object.keys(data))

    // 移除不再存在的区域
    for (const areaId of existingAreaIds) {
      if (!newAreaIds.has(areaId)) {
        const areaGraphics = this.manager[data_key][areaId]
        if (areaGraphics && areaGraphics.parent) {
          console.log('删除了不存在的区域')

          areaGraphics.parent.removeChild(areaGraphics)
          areaGraphics.destroy()
        }
        delete this.manager[data_key][areaId]
      }
    }

    // 更新或创建区域
    for (const { areaId, area } of entriesArray) {
      this.update_or_create_lock_area(areaId, area, data_key, type)
    }

    // this.update_or_create_lock_area()
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

      // 获取车辆当前位置，作为path截取的start_pose
      // const vehicle_obj = this.vehicleStore.getVehicleById(vehicleId)
      // if(vehicle_obj) {
      //   const ox = v.start_pose.x
      //   const oy = v.start_pose.y

      //   let start_pose = v.start_pose
      //   start_pose.x = vehicle_obj.targetPosition.x
      //   start_pose.y = vehicle_obj.targetPosition.y

      //   console.log('update path start pose, vid ', vehicleId,
      //     ' old pose: ', ox, oy,
      //     ' new pose: ', start_pose.x, start_pose.y
      //   )

      // }

      const all_path_t =
        path_type == 'long' ? this.demo_path_to_my_long(v) : this.demo_path_to_my_short(v)
      for (const a_road_path of all_path_t) {
        this.manager.drawLine(g, vehicleId, a_road_path, false, vehicle.color, path_width, alpha)
      }
    }
  }

  /**
   * 处理位置信息更新
   * @param data - 位置数据
   */
  public pose_update(data: PoseUpdateData): void {
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
        task: v.task,
        device_mode: v.device_mode,
        priority: v.priority,
      })
    }
  }

  /***
   * area 相关的类型及key
   */
  get_data_key(type: string): string {
    if (type === 'lock') {
      return 'lockAreas'
    } else if (type === 'limit') {
      return 'limitAreas'
    } else if (type === 'trigger') {
      return 'geoFences'
    } else if (type === 'pla') {
      return 'plaAreas'
    } else if (type === 'plg') {
      return 'plgAreas'
    } else if (type === 'ga') {
      return 'gaAreas'
    } else if (type === 'pga') {
      return 'pgaAreas'
    } else if (type === 'self_area') {
      return 'self_area'
    } else {
      // default
      return 'lockAreas'
    }
  }

  /**
   * 处理锁闭区数据更新
   * @param data - 锁闭区数据
   */
  areas_update(data: LockAreaUpdateData, type: string): void {
    const all_areas = data.data
    const data_key = this.get_data_key(type)

    // 清除text
    // if (type == 'limit') {
    //   this.manager.limitAreaTextContainer.children.forEach((child) => {
    //     child.destroy() // 销毁子元素及其资源
    //   })
    //   this.manager.limitAreaTextContainer.removeChildren()
    // }

    // 获取现有的区域ID集合
    const existingAreaIds = new Set(Object.keys(this.manager[data_key] || {}))
    const newAreaIds = new Set(Object.keys(all_areas))

    // 移除不再存在的区域
    for (const areaId of existingAreaIds) {
      if (!newAreaIds.has(areaId)) {
        const areaGraphics = this.manager[data_key][areaId]
        if (areaGraphics && areaGraphics.parent) {
          areaGraphics.parent.removeChild(areaGraphics)
          areaGraphics.destroy()
        }
        delete this.manager[data_key][areaId]
      }
    }

    // 更新或创建区域
    for (const [areaId, area] of Object.entries(all_areas)) {
      this.update_or_create_lock_area(areaId, area, data_key, type)
    }

    // console.log('锁闭区更新完成，总共绘制了', Object.keys(this.manager[data_key]).length, '个区域')
  }

  /**
   * 更新或创建锁闭区
   * @param areaId - 区域ID
   * @param area - 区域数据
   * @param data_key - 数据键名
   * @param type - 区域类型
   */
  private update_or_create_lock_area(
    areaId: string,
    area: LockArea,
    data_key: string,
    type: string,
  ): void {
    if (!area.polygon || area.polygon.length < 3) {
      console.log('跳过无效的锁闭区:', areaId, area)
      return
    }
    let areaGraphics = this.manager[data_key]?.[areaId]

    const lineWidth =
      ['pgaAreas', 'gaAreas', 'plaAreas', 'self_area'].indexOf(data_key) > -1 ? 0.2 : 1
    if (!areaGraphics) {
      areaGraphics = this.create_lock_area_graphics(areaId, area, data_key, type, lineWidth)
    } else {
      this.update_lock_area_graphics(areaGraphics, area, type, lineWidth)
    }
  }

  /**
   * 更新现有锁闭区图形对象
   * @param areaGraphics - 现有的图形对象
   * @param area - 区域数据
   * @param type - 区域类型
   */
  private update_lock_area_graphics(
    areaGraphics: Graphics,
    area: LockArea,
    type: string,
    lineWidth: number,
  ): void {
    // 根据区域的实际类型设置颜色
    const color = getBorderColor(type)

    // 将多边形数据转换为drawLine需要的格式
    const points = area.polygon.map((point) => [point.x, point.y])

    // 清除现有内容并重新绘制
    areaGraphics.clear()
    this.manager.drawLine(
      areaGraphics,
      (areaGraphics as any).areaId,
      points,
      true, // 使用虚线
      color, // 边框颜色
      lineWidth, // 线宽
      1, // 透明度
    )

    // 更新保存的区域数据
    ;(areaGraphics as any).areaData = area
  }

  /**
   * 创建新的锁闭区图形对象
   * @param areaId - 区域ID
   * @param area - 区域数据
   * @param data_key - 数据键名
   * @param type - 区域类型
   */
  private create_lock_area_graphics(
    areaId: string,
    area: LockArea,
    data_key: string,
    type: string,
    line_width: number,
  ): Graphics {
    // 根据区域的实际类型设置颜色
    const color =
      area.subtype === 'no_parking' ? getBorderColor('no_parking') : getBorderColor(type)

    // 为每个锁闭区创建独立的图形对象
    const areaGraphics = new Graphics()

    // 将多边形数据转换为drawLine需要的格式
    const points: [number, number][] = area.polygon.map((point) => [point.x, point.y])
    // 如何首尾的点不相同，那么将第一个点加入到末尾中
    if (
      points[0][0] !== points[points.length - 1][0] ||
      points[0][1] !== points[points.length - 1][1]
    ) {
      points.push(points[0])
    }

    // 使用drawLine方法绘制锁闭区
    this.manager.drawLine(
      areaGraphics,
      areaId,
      points,
      true, // 使用虚线
      color, // 红色边框
      line_width || 1, // 线宽
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
      // console.log('鼠标悬停在锁闭区上:', areaId)

      // 创建tooltip内容
      const tooltipContent = `
        <div style="font-weight: bold; margin-bottom: 4px;">Area Detail</div>
        <div>name: ${area.name || areaId}</div>
        <div>type: ${area.type || 'lock'}</div>
        <div>sub-type: ${area.subtype || 'lock'}</div>
        <div>create_by: ${area.created_by || 'unknown'}</div>
        <div>desc: ${area.describe || '无'}</div>
        <div>source: ${area.fms ? 'fms' : 'simweb'}</div>
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
          // console.log('鼠标离开锁闭区:', areaId)
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

    // 绘制流量控制区域的约束数量
    if (type == 'limit') {
      const p = this.manager.transform_xy(points[0])
      // [7/12]
      const content = `[${area?.count}/${area?.limit}]`
      const textObj = this.manager.createText(content, p)
      textObj.__ww_update = () => {
        const p = this.manager.transform_xy(points[0])
        textObj.position.set(p[0], p[1])
      }
      // 将text对象添加到容器中
      // this.manager.limitAreaTextContainer.addChild(textObj)
    }
    this.manager.mainContainer.addChild(areaGraphics)
    this.manager[data_key][areaId] = areaGraphics
    return areaGraphics
  }

  /**
   * 绘制单个锁闭区（保留原有方法以兼容性）
   * @param areaId - 区域ID
   * @param area - 区域数据
   */
  private draw_lock_area(areaId: string, area: LockArea, data_key: string, type: string): void {
    this.create_lock_area_graphics(areaId, area, data_key, type)
  }

  /**
   * 绘制单个车辆
   * @param data - 车辆数据
   */
  draw_one_agent(data: AgentData): void {
    const { vehicleId, x, y, theta, tx, ty, t_theta, priority } = data
    if (!this.manager.agents.hasOwnProperty(vehicleId)) {
      this.manager.add_agent(vehicleId, x, -y, theta, theta, tx, -ty, t_theta)
    }
    this.manager.agents[vehicleId].setPosition(x, -y, theta, tx, -ty, t_theta)
    this.manager.agents[vehicleId].v_info.block = data.block
    this.manager.agents[vehicleId].v_info.blocked_by = data.blocked_by
    this.manager.agents[vehicleId].v_info.task = data.task
    this.manager.agents[vehicleId].v_info.device_mode = data.device_mode
    this.manager.agents[vehicleId].v_info.priority = priority

    // 更新车辆文本，包含优先级
    let displayText = vehicleId
    if (this.priorityStore.visible && priority !== null && priority !== undefined) {
      displayText = `${vehicleId} (${priority})`
    }
    this.manager.agents[vehicleId].text.text = displayText
  }

  private demo_path_to_my_long(path: PathData): number[][][] {
    const pathArray = path.path
    const pathLength = pathArray.length
    const startPose = path.start_pose
    const endPose = path.end_pose
    const mapPathInfo = this.manager.map_path_info

    const all_path_t: number[][][] = []
    let last_lcp_point: number[] = [] // 最后一个LCP点
    for (let i = 0; i < pathLength; i++) {
      const path_t: number[][] = []
      const node = pathArray[i]
      const llt_id = node['lane_id']
      const the_road_path = mapPathInfo[llt_id]
      const points = the_road_path.points
      // 如果只有一个节点，则直接使用start index 与end index截取即可
      if (i == 0 && pathLength == 1) {
        const projector = new PointProjection(points as Point[])
        const result = projector.getPointsBetweenProjections(
          [startPose.x, startPose.y],
          [endPose.x, endPose.y],
        )
        path_t.push(...result)
      }
      // 第一个节点，需要根据start行截取
      else if (i == 0) {
        const projector = new PointProjection(points as Point[])
        let p = [startPose.x, startPose.y]
        const result = projector.processPointProjection(p as Point)
        path_t.push(...(result.splitParts?.secondPart || []))
      }
      // 最后一个节点，需要根据end进行截取
      else if (i == pathLength - 1) {
        const projector = new PointProjection(points as Point[])
        let p = [endPose.x, endPose.y]
        const result = projector.processPointProjection(p as Point)
        path_t.length = 0 //清空现有的数据
        path_t.push(...(result.splitParts?.firstPart || []))
      }
      // 中间节点则直接使用完整的points
      else {
        path_t.push(...points)
      }

      // 处理前一个节点有lcp point的情况
      if (last_lcp_point && last_lcp_point.length > 0) {
        // 如果当前是第二个节点（车辆在第一个节点并且有lcp），那么使用车辆位置进行投影，否则使用lcp进行投影
        // lcp/vehicle pose 往当前的path_t进行投影，并保留后面的部分
        const projector = new PointProjection(path_t as Point[])
        let p = i === 1 ? [startPose.x, startPose.y] : last_lcp_point
        const result = projector.processPointProjection(p as Point)
        path_t.length = 0 //清空现有的数据
        path_t.push(...(result.splitParts?.secondPart || []))
      }

      // 处理当前节点有lcp point的情况
      if (node.hasOwnProperty('lcp_point') && node.lcp_point) {
        // 明确告诉 TS lcp_point 存在且非 undefined
        const lcp = node.lcp_point as { x: number; y: number }
        last_lcp_point = [lcp.x, lcp.y]
        // lcp 往当前的path_t进行投影，并保留前面的部分
        const projector = new PointProjection(path_t as Point[])
        const result = projector.processPointProjection(last_lcp_point as Point)
        path_t.length = 0 //清空现有的数据
        path_t.push(...(result.splitParts?.firstPart || []))
      } else {
        // 重置lcp point即可
        last_lcp_point = []
      }

      all_path_t.push(path_t)
    }
    return all_path_t
  }

  private demo_path_to_my_short(path: PathData): number[][][] {
    const pathArray = path.path
    const pathLength = pathArray.length
    const startPose = path.start_pose
    const endPose = path.end_pose
    const mapPathInfo = this.manager.map_path_info

    const all_path_t: number[][][] = []
    const all_points: number[][] = []
    let last_lcp_point: number[] = [] // 最后一个LCP点
    let last_lane_id = ''
    for (let i = 0; i < pathLength; i++) {
      const path_t: number[][] = []
      const node = pathArray[i]
      const llt_id = node['lane_id']
      const the_road_path = mapPathInfo[llt_id]
      const points = the_road_path.points

      if (llt_id === last_lane_id) {
        continue
      }
      last_lane_id = llt_id

      path_t.push(...points)

      // 处理前一个节点有lcp point的情况
      if (last_lcp_point && last_lcp_point.length > 0) {
        // 如果当前是第二个节点（车辆在第一个节点并且有lcp），那么使用车辆位置进行投影，否则使用lcp进行投影
        // lcp/vehicle pose 往当前的path_t进行投影，并保留后面的部分
        const projector = new PointProjection(path_t as Point[])
        let p = i === 1 ? [startPose.x, startPose.y] : last_lcp_point
        const result = projector.processPointProjection(p as Point)
        path_t.length = 0 //清空现有的数据
        path_t.push(...(result.splitParts?.secondPart || []))
      }

      // 处理当前节点有lcp point的情况
      if (node.hasOwnProperty('lcp_point') && node.lcp_point) {
        // 明确告诉 TS lcp_point 存在且非 undefined
        const lcp = node.lcp_point as { x: number; y: number }
        last_lcp_point = [lcp.x, lcp.y]
        // lcp 往当前的path_t进行投影，并保留前面的部分
        const projector = new PointProjection(path_t as Point[])
        const result = projector.processPointProjection(last_lcp_point as Point)
        path_t.length = 0 //清空现有的数据
        path_t.push(...(result.splitParts?.firstPart || []))
      } else {
        // 重置lcp point即可
        last_lcp_point = []
      }

      // 优化连接点过近时显示突兀的问题
      if (all_points.length > 0 && path_t.length > 0) {
        const lp = all_points[all_points.length - 1]
        const p = path_t[0]
        const dis = Math.sqrt((lp[0] - p[0]) ** 2 + (lp[1] - p[1]) ** 2)
        if (dis <= 0.01) {
          path_t.shift()
        } // 过近时去掉第一个点
      }
      all_points.push(...path_t)
    }

    //根据起点及终点进行裁剪
    const projector = new PointProjection(all_points as Point[])
    const result = projector.getPointsBetweenProjections(
      [startPose.x, startPose.y],
      [endPose.x, endPose.y],
    )
    all_points.length = 0
    all_points.push(...result)

    all_path_t.push(all_points)

    // console.log("short all_path_t", all_path_t);

    return all_path_t
  }
}
