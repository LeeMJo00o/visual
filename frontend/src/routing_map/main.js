import {
  Application,
  Assets,
  Graphics,
  BitmapText,
  Text,
  Texture,
  Sprite,
  Container,
  extensions,
  CullerPlugin,
} from 'pixi.js'
import { GraphicTools, stringToUniqueColor, unrotatePoint } from './graph.js'
import {
  WebSocketClient,
  demo_get_traj,
  get_svg_content,
  get_map_config,
  get_path_info,
} from './pp_backend.js'
import { mapCache } from './map_cache.js' // 导入缓存模块
import { EventManager } from './event.js' // 导入事件管理器
import Agent from './agent.js' // 导入 Agent 类
import { DataRenderer } from './data_renderer.js' // 导入数据渲染管理器
// import fontFile from '../assets/DejaVuSansMono-msdf.json?raw'

// const fontDataUrl = `data:application/json;base64,${btoa(fontFile)}`;
// await Assets.load(fontDataUrl);
// extensions.add(CullerPlugin);

const roundTo = (num, decimalPlaces) =>
  Math.round(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)

// 使用window对象存储全局单例实例，避免热重载时丢失
const getGlobalInstance = () => {
  return window.__applicationManagerInstance || null
}

const setGlobalInstance = (instance) => {
  window.__applicationManagerInstance = instance
}

const clearGlobalInstance = () => {
  delete window.__applicationManagerInstance
}

export default class ApplicationManager extends GraphicTools {
  constructor() {
    // 如果已经存在实例，返回现有实例
    const existingInstance = getGlobalInstance()
    if (existingInstance) {
      return existingInstance
    }

    super()

    // 设置全局实例
    setGlobalInstance(this)

    this.app = new Application()
    this.graphics_path_short = null
    this.graphics_path_long = null
    this.graphics_path_apply_area = null
    this.graphics_lock_area = null
    this.agent_graphics = []
    this.isDragging = false
    this.x_init = 0
    this.y_init = 0
    this.agents = {}
    this.ref_interval = 1000
    this.svgContent = null
    this.map_path_info = {}

    this.mainContainer = null
    this.g_rotation = 0
    this.mode = 'test-demo'

    // 车辆平滑移动的配置
    this.smoothMovementConfig = {
      enabled: true, // 是否启用平滑移动
    }

    // 创建事件管理器实例
    this.eventManager = null

    // 创建数据渲染管理器实例
    this.dataRenderer = null

    // 存储锁闭区图形对象
    this.lockAreas = {}
  }

  // 获取单例实例
  static getInstance() {
    const existingInstance = getGlobalInstance()
    if (!existingInstance) {
      console.log('创建新的ApplicationManager实例')
      return new ApplicationManager()
    } else {
      console.log('返回现有的ApplicationManager实例')
      // 确保canvas正确显示
      existingInstance.ensureCanvasDisplay()
      return existingInstance
    }
  }

  // 确保canvas正确显示
  ensureCanvasDisplay() {
    if (this.app && this.app.canvas) {
      const game_container = document.getElementById('map_main_container')
      if (game_container && !game_container.contains(this.app.canvas)) {
        console.log('重新添加canvas到DOM')
        game_container.appendChild(this.app.canvas)
      }

      // 确保应用正常渲染
      if (this.app.renderer) {
        console.log('强制重新渲染PIXI应用')
        this.app.renderer.render(this.app.stage)
      }
    }
  }

  // 清理所有资源（仅在页面完全关闭时调用）
  cleanup() {
    console.log('清理ApplicationManager资源...')

    // 关闭所有WebSocket连接
    if (this.dataRenderer) {
      this.dataRenderer.close_all_websockets()
    }

    // 重置全局单例实例
    clearGlobalInstance()

    console.log('资源清理完成')
  }

  async init() {
    const resolution = window.devicePixelRatio > 1 || window.innerHeight > 1080 ? 2 : 1
    await this.app.init({
      antialias: true,
      autoDensity: true,
      resolution: resolution,
      hello: true,
      width: 1900,
      height: 1280,
      backgroundColor: '#000',
      // preference: "webgpu" # webgl / webgpu
    })
    let game_container = document.getElementById('map_main_container')
    game_container.appendChild(this.app.canvas)
    this.mainContainer = new Container()
    this.agentContainer = new Container()
    this.longPathContainer = new Container()
    this.shortPathContainer = new Container()
    this.agentTextContainer = new Container()

    this.mouse_func = 'default'
    this.drawingStartPoint = null
    this.drawingEndPoint = null
    this.drawingGraphics = null

    // 创建全局tooltip元素
    this.tooltip = document.createElement('div')
    this.tooltip.style.cssText = `
      position: fixed;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.95);
      color: black;
      border-radius: 6px;
      font-size: 14px;
      font-family: monospace;
      pointer-events: none;
      display: none;
      z-index: 1000;
      border: 1px solid #ccc;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `
    document.body.appendChild(this.tooltip)

    try {
      // 获取地图配置
      try {
        const config = await get_map_config()
        console.log('config: ', config)
        this.g_rotation = config.rotation
        this.mainContainer.rotation = this.g_rotation
        this.mainContainer.scale.set(config.scale)
        this.mainContainer.position.set(config.offset[0], config.offset[1])
        this.mode = config.mode

        // 设置缓存版本, 不清理旧缓存
        mapCache.setVersion(config.version)
      } catch (error) {
        console.error('获取地图配置失败:', error)
        throw error
      }

      // 获取路径数据（使用缓存）
      const cachedPathInfo = await mapCache.get('path_info')
      if (cachedPathInfo) {
        console.log('使用缓存的路径数据')
        this.map_path_info = cachedPathInfo
      } else {
        console.log('从服务器获取路径数据')
        try {
          const pathInfo = await get_path_info()
          console.log('获取路径数据成功，数据长度:', Object.keys(pathInfo).length)
          this.map_path_info = pathInfo
          await mapCache.save('path_info', pathInfo)
        } catch (error) {
          console.error('获取路径数据失败:', error)
          throw error
        }
      }
      // 等待initMap完成
      this.map_container = await this.initMap()

      this.app.stage.addChild(this.mainContainer)

      this.app.stage.addChild(this.agentTextContainer)

      this.graphics_path_apply_area = new Graphics()
      this.graphics_lock_area = new Graphics()

      this.add_graphics(this.map_container)
      this.mainContainer.addChild(this.longPathContainer)
      this.mainContainer.addChild(this.shortPathContainer)
      this.add_graphics(this.graphics_path_apply_area)
      this.add_graphics(this.graphics_lock_area)
      this.mainContainer.addChild(this.agentContainer)

      this.drawingGraphics = new Graphics()
      this.app.stage.addChild(this.drawingGraphics)

      this.graphics_path_apply_area.alpha = 0.5

      // 初始化事件管理器
      this.eventManager = new EventManager(this.app, this)
      this.eventManager.setupEventListeners()

      // 初始化数据渲染管理器
      this.dataRenderer = new DataRenderer(this)
      this.dataRenderer.init_websockets(this.mode)

      // 设置动画循环，更新所有车辆位置
      const tickerCallback = () => this.updateAgents()
      this.app.ticker.add(tickerCallback)

      // 页面卸载时清理资源
      window.addEventListener('beforeunload', () => {
        console.log('页面卸载，清理ApplicationManager资源')
        this.cleanup()
      })
    } catch (error) {
      console.error('初始化失败:', error)
      throw error
    }
  }

  // 坐标变换，注意 pixijs 的变换顺序是 缩放、旋转、平移
  // 考虑地图坐标 (raw_x, raw_y) 则点击位置 (x, y) 与原位置的关系为：
  // x = rotate(raw_x * scale) + offset_x
  // 逆运算即可算出原坐标

  raw_xy(x, y) {
    let scale = this.mainContainer.scale.x

    let _x = x - this.mainContainer.position.x
    let _y = y - this.mainContainer.position.y

    let newPoint = unrotatePoint(_x, _y, this.g_rotation)

    let t_x = newPoint.x / scale
    let t_y = newPoint.y / scale
    t_y = -t_y // 前端 y 的方向与原地图相反
    return [roundTo(t_x, 4), roundTo(t_y, 4)]
  }

  add_agent(vehicle_id, x = 0, y = 0, theta = 0) {
    console.log('add agent:', vehicle_id, x, y, theta)
    let v = new Agent(this, vehicle_id)
    // this.agent_graphics.push(v.graphics)
    v.graphics.interactive = true
    v.graphics.cursor = 'pointer'

    this.agents[vehicle_id] = v
    this.agents[vehicle_id].setPosition(x, y, theta)

    // 添加鼠标悬停事件处理，显示车辆信息
    v.graphics.on('pointerover', (e) => {
      // 高亮显示车辆
      v.graphics.tint = 0xffffff // 亮白色

      // 创建tooltip内容
      const agent = this.agents[vehicle_id]
      const tooltipContent = `
        <div style="font-weight: bold; margin-bottom: 4px;">Vehicle Info</div>
        <div>id: ${agent.vehicle_id}</div>
        <div>pose: ${agent.position.x.toFixed(3)}, ${-agent.position.y.toFixed(3)}, ${agent.position.theta.toFixed(3)}</div>
      `

      // 显示tooltip
      if (this.tooltip) {
        this.tooltip.innerHTML = tooltipContent
        this.tooltip.style.display = 'block'
        this.tooltip.style.left = e.clientX + 15 + 'px'
        this.tooltip.style.top = e.clientY + 10 + 'px'

        // 跟随鼠标移动
        const onMouseMove = (moveEvent) => {
          this.tooltip.style.left = moveEvent.clientX + 15 + 'px'
          this.tooltip.style.top = moveEvent.clientY + 10 + 'px'
        }

        // 鼠标离开时移除事件监听
        const onPointerOut = () => {
          document.removeEventListener('mousemove', onMouseMove)
          this.tooltip.style.display = 'none'
          v.graphics.tint = 0xffffff // 恢复正常颜色
          // 移除pointerout事件监听器，避免重复绑定
          v.graphics.off('pointerout', onPointerOut)
        }

        document.addEventListener('mousemove', onMouseMove)
        v.graphics.on('pointerout', onPointerOut)
      }
    })

    console.log('add graphics1: ', v)
    console.log('add graphics2: ', v.graph_long_path)

    this.agentContainer.addChild(v.graphics)
    this.longPathContainer.addChild(v.graph_long_path)
    this.shortPathContainer.addChild(v.graph_short_path)

    this.agentTextContainer.addChild(v.text)

    return v
    // g.on('pointerover', () => {
    //     console.log('鼠标悬停在车上', g);
    // });

    // g.on('pointerout', () => {
    //     console.log('鼠标离开车');
    // });
  }

  add_graphics(g, index = null) {
    if (index === null) {
      this.mainContainer.addChild(g)
    } else {
      this.mainContainer.addChildAt(g, index)
    }
    g.interactive = true
    g.cursor = 'pointer'
  }

  // 新增：绘制箭头的辅助方法
  drawArrow(graphics, x, y, angle, size = 1, color = '#ff0000', alpha = 1) {
    // 计算箭头的三个点
    const arrowLength = size
    const arrowWidth = size * 2

    // 箭头头部（指向方向）- 向前延伸
    const tipX = x + arrowLength * Math.cos(angle)
    const tipY = y + arrowLength * Math.sin(angle)

    // 箭头尾部两个点 - 向后延伸
    const leftX = x - arrowLength * Math.cos(angle) + arrowWidth * Math.cos(angle + Math.PI * 0.75)
    const leftY = y - arrowLength * Math.sin(angle) + arrowWidth * Math.sin(angle + Math.PI * 0.75)
    const rightX = x - arrowLength * Math.cos(angle) + arrowWidth * Math.cos(angle - Math.PI * 0.75)
    const rightY = y - arrowLength * Math.sin(angle) + arrowWidth * Math.sin(angle - Math.PI * 0.75)

    // 绘制实心三角形箭头
    graphics.poly([tipX, tipY, leftX, leftY, rightX, rightY]).fill({ color: color, alpha: alpha })
  }

  // 新增：计算两点之间的角度
  calculateAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1)
  }

  // 设置鼠标功能
  setMouseFunction(func) {
    this.mouse_func = func
    if (func === 'draw') {
      // 设置鼠标为十字光标
      if (this.app && this.app.canvas) {
        this.app.canvas.style.cursor = 'crosshair'
      }
      // 禁用mainContainer的交互
      if (this.mainContainer) {
        this.mainContainer.interactive = false
        this.mainContainer.eventMode = 'none'
      }
      console.log('进入画框模式')
    } else {
      // 恢复默认光标
      if (this.app && this.app.canvas) {
        this.app.canvas.style.cursor = 'default'
      }
      // 恢复mainContainer的交互
      if (this.mainContainer) {
        this.mainContainer.interactive = true
        this.mainContainer.eventMode = 'static'
      }
      console.log('退出画框模式')
    }
  }

  // 处理画框相关的鼠标事件
  handleDrawingMouseDown(e) {
    if (this.mouse_func !== 'draw') return

    const point = e.global
    this.drawingStartPoint = { x: point.x, y: point.y }

    console.log('开始画框:', this.drawingStartPoint)
    this.drawingGraphics.clear()
  }

  handleDrawingMouseMove(e) {
    if (this.mouse_func !== 'draw' || !this.drawingStartPoint || !this.drawingGraphics) return

    const point = e.global
    this.drawingEndPoint = { x: point.x, y: point.y }

    // 清除之前的绘制
    this.drawingGraphics.clear()

    // 计算矩形的实际位置和尺寸，支持任意方向拖动
    const left = Math.min(this.drawingStartPoint.x, this.drawingEndPoint.x)
    const top = Math.min(this.drawingStartPoint.y, this.drawingEndPoint.y)
    const width = Math.abs(this.drawingEndPoint.x - this.drawingStartPoint.x)
    const height = Math.abs(this.drawingEndPoint.y - this.drawingStartPoint.y)

    this.drawingGraphics.rect(left, top, width, height).stroke({ color: '#ff0000', width: 2 })
  }

  handleDrawingMouseUp(e) {
    if (this.mouse_func !== 'draw' || !this.drawingStartPoint || !this.drawingGraphics) return

    const point = e.global
    this.drawingEndPoint = { x: point.x, y: point.y }

    // 完成画框
    console.log('完成画框:', this.drawingStartPoint, this.drawingEndPoint)

    // 计算矩形的实际位置和尺寸
    const left = Math.min(this.drawingStartPoint.x, this.drawingEndPoint.x)
    const top = Math.min(this.drawingStartPoint.y, this.drawingEndPoint.y)
    const width = Math.abs(this.drawingEndPoint.x - this.drawingStartPoint.x)
    const height = Math.abs(this.drawingEndPoint.y - this.drawingStartPoint.y)

    // 保存画框信息，但不立即清除
    this.currentDrawingInfo = {
      left: left,
      top: top,
      width: width,
      height: height,
    }

    // 重置状态
    this.drawingStartPoint = null
    this.drawingEndPoint = null

    // 恢复默认鼠标功能
    this.setMouseFunction('default')

    // 显示确认对话框
    this.showDrawingConfirmDialog(left, top, width, height)
  }

  // 显示画框确认对话框
  showDrawingConfirmDialog(left, top, width, height) {
    // 计算四个顶点的屏幕坐标
    const screenVertices = [
      { x: left, y: top }, // 左上角
      { x: left + width, y: top }, // 右上角
      { x: left + width, y: top + height }, // 右下角
      { x: left, y: top + height }, // 左下角
    ]

    // 转换为地图坐标用于显示
    const mapVertices = screenVertices.map((vertex) => {
      const [mapX, mapY] = this.raw_xy(vertex.x, vertex.y)
      return { x: mapX, y: mapY }
    })

    const verticesText = mapVertices
      .map((v, i) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}]`)
      .join('<br>')

    // 导入Element Plus的ElMessageBox
    import('element-plus')
      .then(({ ElMessageBox }) => {
        ElMessageBox.confirm(`${verticesText}`, '画框确认', {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          type: 'success',
          dangerouslyUseHTMLString: true,
        })
          .then(() => {
            // 用户点击确认，发送HTTP请求
            this.sendDrawingRequest(left, top, width, height)
          })
          .catch(() => {
            // 用户点击取消，什么都不做
            console.log('用户取消了画框操作')
          })
          .finally(() => {
            // 无论用户选择什么，都清除画框
            this.clearCurrentDrawing()
          })
      })
      .catch((error) => {
        console.error('加载Element Plus组件失败:', error)
        // 降级处理：使用原生confirm
        const confirmed = confirm(
          `确认要处理这个区域吗？\n\n${verticesText}\n\n尺寸: ${width.toFixed(2)} x ${height.toFixed(2)}`,
        )
        if (confirmed) {
          this.sendDrawingRequest(left, top, width, height)
        }
        // 无论用户选择什么，都清除画框
        this.clearCurrentDrawing()
      })
  }

  // 清除当前画框
  clearCurrentDrawing() {
    if (this.drawingGraphics) {
      this.drawingGraphics.clear()
    }
    // 清除保存的画框信息
    this.currentDrawingInfo = null
  }

  // 发送画框请求
  async sendDrawingRequest(left, top, width, height) {
    try {
      // 导入axios
      const { default: axios } = await import('axios')

      // 计算四个顶点的屏幕坐标
      const screenVertices = [
        { x: left, y: top }, // 左上角
        { x: left + width, y: top }, // 右上角
        { x: left + width, y: top + height }, // 右下角
        { x: left, y: top + height }, // 左下角
      ]

      // 转换为地图坐标
      const mapVertices = screenVertices.map((vertex) => {
        const [mapX, mapY] = this.raw_xy(vertex.x, vertex.y)
        return { x: mapX, y: mapY }
      })

      // 创建闭合多边形（添加第一个点作为最后一个点）
      const polygon = [...mapVertices, mapVertices[0]]

      const requestData = {
        name: 'lock_area_' + Date.now(), // 生成唯一名称
        subtype: 'lock',
        type: 'lock',
        created_by: 'pp-visual',
        describe: '',
        polygon: polygon,
      }

      console.log('发送画框请求:', requestData)

      // 发送HTTP请求到后端
      const response = await axios.post('/api/map/add_lock_area', requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('画框请求成功:', response.data)

      // 导入Element Plus的ElMessage显示成功消息
      const { ElMessage } = await import('element-plus')
      ElMessage.success('画框处理成功')
    } catch (error) {
      console.error('画框请求失败:', error)

      // 显示错误消息
      try {
        const { ElMessage } = await import('element-plus')
        ElMessage.error('画框处理失败: ' + (error.response?.data?.message || error.message))
      } catch (importError) {
        console.error('无法加载Element Plus消息组件:', importError)
        alert('画框处理失败: ' + (error.response?.data?.message || error.message))
      }
    }
  }

  draw_map_road(g, points, color, alpha = 0.5) {
    const width = 1
    g.clear()
    this.drawLine(g, 'N/A', points, false, color, width, alpha)
    // 在路径中间点绘制箭头
    if (points.length >= 2) {
      let arrowPoint, angle

      if (points.length === 2) {
        // 只有两个点时，取中间点
        const startPoint = points[0] // 起点
        const endPoint = points[1] // 终点
        arrowPoint = [
          (startPoint[0] + endPoint[0]) / 2, // 中间点x坐标
          (startPoint[1] + endPoint[1]) / 2, // 中间点y坐标
        ]
        const [startX, startY] = this.map_xy_to_app(startPoint)
        const [endX, endY] = this.map_xy_to_app(endPoint)
        angle = this.calculateAngle(startX, startY, endX, endY)
      } else {
        // 多个点时，取中间点
        const midIndex = Math.floor(points.length / 2)
        arrowPoint = points[midIndex]

        // 计算箭头方向（使用中间点前后的点）
        if (midIndex > 0 && midIndex < points.length - 1) {
          // 使用前后两个点计算方向
          const prevPoint = points[midIndex - 1]
          const nextPoint = points[midIndex + 1]
          const [prevX, prevY] = this.map_xy_to_app(prevPoint)
          const [nextX, nextY] = this.map_xy_to_app(nextPoint)
          angle = this.calculateAngle(prevX, prevY, nextX, nextY)
        } else if (midIndex > 0) {
          // 使用前一个点
          const prevPoint = points[midIndex - 1]
          const [prevX, prevY] = this.map_xy_to_app(prevPoint)
          const [midX, midY] = this.map_xy_to_app(arrowPoint)
          angle = this.calculateAngle(prevX, prevY, midX, midY)
        } else {
          // 使用后一个点
          const nextPoint = points[midIndex + 1]
          const [midX, midY] = this.map_xy_to_app(arrowPoint)
          const [nextX, nextY] = this.map_xy_to_app(nextPoint)
          angle = this.calculateAngle(midX, midY, nextX, nextY)
        }
      }

      const [arrowX, arrowY] = this.map_xy_to_app(arrowPoint)

      // 绘制箭头
      this.drawArrow(g, arrowX, arrowY, angle, 1, color, alpha)
    }
  }

  async initMap() {
    // console.log('map_path_info: ', this.map_path_info)
    const cons = new Container({
      isRenderGroup: true,
    })

    this.path_tooltip = document.createElement('div')
    this.path_tooltip.style.cssText = `
      position: fixed;
      padding: 5px 8px;
      background: white;
      color: black;
      border-radius: 4px;
      font-size: 14px;
      pointer-events: none;
      display: none;
      z-index: 1000;
      border: 1px solid black;
    `
    document.body.appendChild(this.path_tooltip)

    Object.entries(this.map_path_info).forEach(([path_id, one_path]) => {
      // console.log(path_id, one_path);
      const points = one_path['points']

      let g = new Graphics()
      cons.addChild(g)

      // 直接使用 drawLine 方法
      this.draw_map_road(g, points, '#fff', 0.4)

      g.on('pointerover', (e) => {
        this.draw_map_road(g, points, '#f0f', 0.8)
        // 将路径提升到最上层
        cons.setChildIndex(g, cons.children.length - 1)
        // console.log('pointerover', g.raw_path.getAttribute('id'));

        // 获取所有属性
        // console.log("attrs", one_path["attrs"])
        let attributes = ''
        if (one_path['attrs'] && typeof one_path['attrs'] === 'object') {
          // 定义需要过滤掉的属性
          const filteredAttrs = [
            'L_ID',
            'block_id',
            'is_straight',
            'road_type',
            'pptype',
            'cutin',
            'cutin_from',
          ]
          const filteredEntries = Object.entries(one_path['attrs']).filter(([key, value]) =>
            filteredAttrs.includes(key),
          ) // 过滤掉不需要的属性
          attributes += '<pre style="margin: 0; font-family: inherit;"><code>'
          attributes += `path_id: ${path_id}<br>`
          filteredEntries.forEach(([key, value]) => {
            attributes += `${key}: ${value}\n`
          })
          attributes += '</code></pre>'
        }
        this.path_tooltip.innerHTML = attributes
        this.path_tooltip.style.display = 'block'
        this.path_tooltip.style.left = e.clientX + 15 + 'px'
        this.path_tooltip.style.top = e.clientY + 10 + 'px'
      })
      g.on('pointerout', (e) => {
        this.path_tooltip.style.display = 'none'
        this.draw_map_road(g, points, '#fff')
      })

      g.interactive = true
      g.cursor = 'pointer'

      // 保存原始数据用于交互
      g.path_id = path_id
      g.original_points = points
    })

    // cons.alpha = 0.6;
    return cons
  }

  graphics_sacle_move(e, scale_level_v) {
    const graphic = this.mainContainer
    let the_x = e.global.x - graphic.position.x
    let the_y = e.global.y - graphic.position.y

    // 缩放
    const scale_to = graphic.scale.x * scale_level_v
    graphic.scale.set(scale_to)

    // 缩放以左上角为原点，为了看起来是在指针处缩放的，我们把原先指针所指的点移回指针位置
    // 考虑某个点坐标 x, 缩放之后位置会偏移 (x * scale_level_v) 的距离
    // 因此需要调整的距离是 (x * scale_level_v) - x
    this.move_all(-the_x * (scale_level_v - 1), -the_y * (scale_level_v - 1))
  }

  move_all(off_x, off_y) {
    this.mainContainer.position.set(
      this.mainContainer.position.x + off_x,
      this.mainContainer.position.y + off_y,
    )

    // 更新所有文本的位置
    Object.values(this.agents).forEach((agent) => {
      agent.sync_text_pos(agent.position.x, agent.position.y)
    })

    console.log('main container: ', this.mainContainer.position, this.mainContainer.scale.x)
  }

  // 更新所有车辆的位置
  updateAgents() {
    // 如果动画被禁用，直接返回，不执行任何操作
    if (!this.smoothMovementConfig.enabled) {
      return
    }

    // 遍历所有车辆，调用更新方法
    for (const agent of Object.values(this.agents)) {
      agent.update()
      // 在动画更新后同步文本位置
      agent.sync_text_pos(agent.position.x, agent.position.y)
    }
  }

  map_xy_to_app(point) {
    return [point[0], -point[1]]
  }
}
