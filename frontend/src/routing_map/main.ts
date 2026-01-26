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
  SCALE_MODES,
} from 'pixi.js'
import dayjs from 'dayjs'
import { GraphicTools, stringToUniqueColor, unrotatePoint } from './graph.ts'
import {
  WebSocketClient,
  demo_get_traj,
  get_svg_content,
  get_map_config,
  get_path_info,
  get_vpb_info,
} from './pp_backend.js'
import { mapCache } from './map_cache.js' // 导入缓存模块
import { EventManager } from './event.js' // 导入事件管理器
import Agent from './agent.js' // 导入 Agent 类
import { DataRenderer } from './data_renderer.ts' // 导入数据渲染管理器
import { storeToRefs } from 'pinia'
import { useGlobalSettingsStore } from '@/stores/useLocalStorage.ts'
import { useGlobalStore } from '@/stores/globalStore'


// 延迟获取 store，避免在模块加载时 Pinia 还未初始化
// 改为在类方法中需要时才获取 store 实例
let _settingsStore: ReturnType<typeof useGlobalSettingsStore> | null = null
let _globalSettings: any = null

// 获取 store 的辅助函数，确保在 Pinia 初始化后才调用
function getSettingsStore() {
  if (!_settingsStore) {
    _settingsStore = useGlobalSettingsStore()
    const refs = storeToRefs(_settingsStore)
    _globalSettings = refs.globalSettings
  }
  return _settingsStore
}

function getGlobalSettings() {
  if (!_globalSettings) {
    getSettingsStore()
  }
  return _globalSettings
}

// const fontDataUrl = `data:application/json;base64,${btoa(fontFile)}`;
// await Assets.load(fontDataUrl);
// extensions.add(CullerPlugin);

interface AgentMap {
  [vehicleId: string]: Agent
}

interface LockAreasMap {
  [areaId: string]: Graphics
}

interface MapPathInfo {
  [pathId: string]: {
    points: number[][]
    attrs?: Record<string, any>
  }
}

interface SmoothMovementConfig {
  enabled: boolean
}

interface Position {
  x: number
  y: number
  theta: number
}

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
  public app: Application
  public agents: AgentMap = {}
  public dataRenderer: DataRenderer | null // 暴露给外部使用
  public isSuspend: boolean = false // 是否暂停数据渲染，回放时为true
  public gaAreas: Record<string, Graphics> = {}
  public plaAreas: Record<string, Graphics> = {}
  public pgaAreas: Record<string, Graphics> = {}
  public self_area: Record<string, Graphics> = {}

  // 动态vpb图形对象, key为lanelt_id
  public dynamic_vpb_lanes: Record<string, Record<string, Graphics>> = {}
  // 通用的图形对象, key为类型, 用于区分不同类型的图形; 值为, id: graphics的对象
  public common_graphics: Record<string, Record<string, Graphics>> = {}
  // 测量点图形对象
  public g_mesure_point1: Graphics | null = null
  public g_mesure_point2: Graphics | null = null
  // 测量点相关
  public measurePointsContainer: Container | null = null
  public measurePointGraphics: {
    point1: Graphics | null
    point2: Graphics | null
    line: Graphics | null
    label1: Text | null
    label2: Text | null
  } = {
      point1: null,
      point2: null,
      line: null,
      label1: null,
      label2: null,
    }
  public manualPathContainer: Container | null = null
  public manualPathPreviewGraphics: Graphics | null = null
  public manualPathArrowGraphics: Graphics | null = null
  public manualPathState = {
    active: false,
    dragging: false,
    startPoint: null as Position | null,
  }
  public parkingPathContainer: Container | null = null
  public parkingPathPreviewGraphics: Graphics | null = null
  public parkingPathPoseContainer: Container | null = null
  public parkingPathArrowGraphics: Graphics | null = null
  public parkingObstacleGraphics: Graphics | null = null
  public parkingPathState = {
    active: false,
    dragging: false,
    startPoint: null as Position | null,
  }

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
    this.mouse_func = 'default' // 保留鼠标功能模式，供事件管理器使用

    this.smoothMovementConfig = { // 车辆平滑移动的配置
      enabled: true,
    }
    this.backgroundImageConfig = { // 是否显示背景图片
      visible: true,
    }
    this.eventManager = null

    this.lockAreas = {}       // 存储锁闭区 Graphics
    this.limitAreas = {}      // 存储流量控制区域 Graphics
    this.geoFences = {}       // 存储电子围栏 Graphics
    this.gaAreas = {}         // ga Graphics
    this.plaAreas = {}        // pla Graphics
    this.pgaAreas = {}        // pga Graphics
    this.self_area = {}       // self 区域 Graphics

    // 通用的图形对象集合
    this.common_graphics = {}

    // 存储画框处理方法（由LockArea.vue设置）
    this.drawingHandlers = null

    // 存储背景图片精灵对象
    this.backgroundSprite = null

    // 时间显示文本对象
    this.timeText = null

    // 时间更新定时器
    this.timeUpdateInterval = null

    this.manualPathContainer = null
    this.manualPathPreviewGraphics = null
    this.manualPathArrowGraphics = null
    this.parkingPathContainer = null
    this.parkingPathPreviewGraphics = null
    this.parkingPathPoseContainer = null
    this.parkingPathArrowGraphics = null
    this.parkingObstacleGraphics = null
  }

  /**
   * 直接设置顶部时间文本（同步、无延迟）。
   * 回放模式下由回放控件主动调用，避免等待 1s 定时器。
   */
  setTopTimeText(text: string) {
    if (this.timeText) {
      this.timeText.text = text
    }
  }

  /**
   * 立即刷新顶部时间显示（同步读取 store 的回放/实时状态）。
   */
  updateTopTimeDisplayNow() {
    this.updateTimeDisplay()
  }

  /**
   * 绘制或更新测量点
   */
  updateMeasurePoint(pointId: 'point1' | 'point2', x: number, y: number) {
    // 将地图坐标转换为应用坐标（翻转y轴）
    const [appX, appY] = this.map_xy_to_app([x, y])

    const color = pointId === 'point1' ? 0x00bfff : 0xa578ff // 深天蓝 / 浅紫
    const text = pointId === 'point1' ? this.p_text1 : this.p_text2
    const g = pointId === 'point1' ? this.g_mesure_point1 : this.g_mesure_point2

    g.clear().circle(appX, appY, 0.7).fill({ color: color, alpha: 0.8})

    text.position.set(appX, appY)
  }

  /**
   * 设置测量点显示/隐藏
   */
  setMeasurePointsVisible(visible: boolean) {
    this.measureContainer.visible = visible
  }

  // 获取单例实例
  static getInstance() {
    const existingInstance = getGlobalInstance()
    // 检查实例是否有效（app 属性必须存在）
    if (existingInstance && existingInstance.app) {
      existingInstance.ensureCanvasDisplay()
      return existingInstance
    }

    console.log('create new ApplicationManager !')
    return new ApplicationManager()
  }


  // 确保canvas正确显示，保证 debug 时，vue 组建重载能够正确显示主界面
  ensureCanvasDisplay() {
    if (!this.app || !this.app.canvas) {
      console.log('ensureCanvasDisplay: app or canvas not ready, skipping')
      return
    }
    const game_container = document.getElementById('map_main_container')
    if (game_container && !game_container.contains(this.app.canvas)) {
      console.log('re add canvas to DOM')
      game_container.appendChild(this.app.canvas)
    }
    if (!this.app.renderer) {
      console.log('no render!')
    }
  }

  // 清理所有资源（仅在页面完全关闭时调用）
  cleanup() {
    console.log('清理ApplicationManager资源...')

    // 关闭所有WebSocket连接
    if (this.dataRenderer) {
      this.dataRenderer.close_all_websockets()
    }

    // 清理时间更新定时器
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval)
      this.timeUpdateInterval = null
    }

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
    const game_container = document.getElementById('map_main_container')
    if (game_container) {
      game_container.appendChild(this.app.canvas)

      // 阻止地图容器的滚轮事件传播到页面，避免页面滚动
      game_container.addEventListener('wheel', (e) => {
        e.preventDefault()
      }, { passive: false })

      game_container.addEventListener('contextmenu', (e) => {
        e.preventDefault()
      })
    }

    this.mainContainer = new Container()
    this.agentContainer = new Container()
    this.longPathContainer = new Container()
    this.shortPathContainer = new Container()
    this.agentTextContainer = new Container()
    // 设置文本容器不响应鼠标事件，避免干扰车辆图形的交互
    this.agentTextContainer.eventMode = 'none'
    // limit area 显示文本容器
    this.limitAreaTextContainer = new Container()
    this.limitAreaTextContainer.eventMode = 'none'

    // 创建时间显示文本
    this.timeText = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 20,
        fill: 0xffffff,
        stroke: 0x000000,
        align: 'center',
      },
    })
    this.timeText.anchor.set(0.5, 0) // 水平居中，垂直顶部对齐
    this.timeText.position.set(750, 20) // 位置在顶部中间偏左，距离顶部20像素
    this.timeText.eventMode = 'none' // 不响应鼠标事件

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
        this.map_config = config
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

      // 检查是否启用背景图片
      if (this.map_config.use_back_image === true) {
        const backgroundTexture = await Assets.load(`/map/${this.map_config.back_image_file}`)
        this.backgroundSprite = new Sprite(backgroundTexture)

        this.backgroundSprite.position.set(
          this.map_config.offset_back_image[0],
          this.map_config.offset_back_image[1],
        )
        this.backgroundSprite.scale = this.map_config.scale_back
        this.backgroundSprite.rotation = -this.g_rotation
        this.backgroundSprite.eventMode = 'none'

        this.backgroundSprite.visible = getGlobalSettings().value.background_image_show //this.backgroundImageConfig.visible

        this.mainContainer.addChildAt(this.backgroundSprite, 0)
      }

      // 获取vpb 信息
      const vpb_info = await get_vpb_info()

      this.map_container = await this.initMap(vpb_info)

      // 默认关闭地图显示
      this.map_container.visible = getGlobalSettings().value.map_show   //!this.map_config.use_back_image
      this.app.stage.addChild(this.mainContainer)

      this.app.stage.addChild(this.agentTextContainer)

      this.app.stage.addChild(this.limitAreaTextContainer)

      // 添加时间文本到舞台，确保显示在最上层
      this.app.stage.addChild(this.timeText)

      this.graphics_path_apply_area = new Graphics()

      this.add_graphics(this.map_container)

      this.mainContainer.addChild(this.longPathContainer)
      this.mainContainer.addChild(this.shortPathContainer)
      this.add_graphics(this.graphics_path_apply_area)
      this.mainContainer.addChild(this.agentContainer)

      this.measureContainer = new Container()
      this.g_mesure_point1 = new Graphics()
      this.g_mesure_point2 = new Graphics()

      this.p_text1 = new Text({
        text: "P1",
        style: {
          fontSize: 40,
          fill: 0x00bfff,
        },
      })
      // this.p_text1.anchor.set(0.5, 1.2)
      this.p_text1.position.set(0, 0)
      this.p_text1.rotation = -this.g_rotation
      this.p_text1.scale.set(0.15)

      this.p_text2 = new Text({
        text: "P2",
        style: {
          fontSize: 40,
          fill: 0xa578ff,
        },
      })

      // this.p_text2.anchor.set(0.5, 1.2)
      this.p_text2.position.set(0, 0)
      this.p_text2.rotation = -this.g_rotation
      this.p_text2.scale.set(0.15)

      this.measureContainer.addChild(this.g_mesure_point1)
      this.measureContainer.addChild(this.g_mesure_point2)
      this.measureContainer.addChild(this.p_text1)
      this.measureContainer.addChild(this.p_text2)
      this.setMeasurePointsVisible(false)
      this.mainContainer.addChild(this.measureContainer)

      this.manualPathContainer = new Container()
      this.manualPathPreviewGraphics = new Graphics()
      this.manualPathArrowGraphics = new Graphics()
      this.manualPathContainer.addChild(this.manualPathPreviewGraphics)
      this.manualPathContainer.addChild(this.manualPathArrowGraphics)
      this.mainContainer.addChild(this.manualPathContainer)

      this.parkingPathContainer = new Container()
      this.parkingPathPreviewGraphics = new Graphics()
      this.parkingPathPoseContainer = new Container()
      this.parkingPathArrowGraphics = new Graphics()
      this.parkingObstacleGraphics = new Graphics()
      this.parkingPathContainer.addChild(this.parkingPathPreviewGraphics)
      this.parkingPathContainer.addChild(this.parkingPathPoseContainer)
      this.parkingPathContainer.addChild(this.parkingPathArrowGraphics)
      this.parkingPathContainer.addChild(this.parkingObstacleGraphics)
      this.mainContainer.addChild(this.parkingPathContainer)

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

      // 设置时间显示更新定时器，每秒更新一次
      this.timeUpdateInterval = setInterval(() => {
        this.updateTimeDisplay()
      }, 1000)

      // 立即显示当前时间，不等待1秒
      this.updateTimeDisplay()

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

  // 暂停和回复都得清理原先存在的数据，
  // 暂停websocket数据渲染
  public pauseWSDataRendering() {
    this.clearDynamicData()
    this.isSuspend = true
  }
  // 恢复websocket数据渲染
  public resumeWSDataRendering() {
    this.clearDynamicData()
    this.isSuspend = false
  }

  /**
   * 清理现有的动态数据
   * 1. 车辆
   * 2. 长短路径
   * 3.区域绘制
   */
  // ...existing code...
  private clearDynamicData() {
    console.log(
      'clearDynamicData: clearing dynamic data, agents count=',
      Object.keys(this.agents).length,
    )

    // 先销毁/移除所有 agent 相关显示对象
    Object.values(this.agents).forEach((agent: any) => {
      try {
        // 从父容器移除
        if (agent.graphics && agent.graphics.parent)
          agent.graphics.parent.removeChild(agent.graphics)
        if (agent.graph_long_path && agent.graph_long_path.parent)
          agent.graph_long_path.parent.removeChild(agent.graph_long_path)
        if (agent.graph_short_path && agent.graph_short_path.parent)
          agent.graph_short_path.parent.removeChild(agent.graph_short_path)
        if (agent.text && agent.text.parent) agent.text.parent.removeChild(agent.text)

        // 销毁对象（防止内存泄露）
        const destroyOpts = { children: true, texture: false, baseTexture: false }
        if (agent.graphics && typeof agent.graphics.destroy === 'function')
          agent.graphics.destroy(destroyOpts)
        if (agent.graphics_head && typeof agent.graphics_head.destroy === 'function')
          agent.graphics_head.destroy(destroyOpts)
        if (agent.graphics_trailer && typeof agent.graphics_trailer.destroy === 'function')
          agent.graphics_trailer.destroy(destroyOpts)
        if (agent.graph_long_path && typeof agent.graph_long_path.destroy === 'function')
          agent.graph_long_path.destroy(destroyOpts)
        if (agent.graph_short_path && typeof agent.graph_short_path.destroy === 'function')
          agent.graph_short_path.destroy(destroyOpts)
        if (agent.text && typeof agent.text.destroy === 'function') agent.text.destroy()
      } catch (e) {
        console.warn('clearDynamicData: error destroying agent', agent && agent.vehicle_id, e)
      }
    })

    // 清空 agents 映射
    this.agents = {}

    // 清空并移除容器内残留图形
    if (this.agentContainer) this.agentContainer.removeChildren()
    if (this.longPathContainer) this.longPathContainer.removeChildren()
    if (this.shortPathContainer) this.shortPathContainer.removeChildren()
    if (this.agentTextContainer) this.agentTextContainer.removeChildren()

    // 清理应用级别的 graphics（如果存在）
    if (this.graphics_path_apply_area) {
      if (this.graphics_path_apply_area.parent)
        this.graphics_path_apply_area.parent.removeChild(this.graphics_path_apply_area)
      try {
        this.graphics_path_apply_area.clear()
      } catch (e) { }
    }

    // 清理锁闭区 / 流控 / 围栏 等
    const clearGraphicsMap = (mapObj: Record<string, any>) => {
      Object.values(mapObj).forEach((g: any) => {
        try {
          if (g.parent) g.parent.removeChild(g)
          if (typeof g.clear === 'function') g.clear()
          if (typeof g.destroy === 'function') g.destroy({ children: true })
        } catch (e) { }
      })
    }
    clearGraphicsMap(this.lockAreas)
    clearGraphicsMap(this.limitAreas)
    clearGraphicsMap(this.geoFences)

    clearGraphicsMap(this.gaAreas)
    clearGraphicsMap(this.plaAreas)
    clearGraphicsMap(this.pgaAreas)
    clearGraphicsMap(this.self_area)

    Object.values(this.common_graphics).forEach(items => {
      clearGraphicsMap(items)
    })

    this.lockAreas = {}
    this.limitAreas = {}
    this.geoFences = {}

    this.gaAreas = {}
    this.plaAreas = {}
    this.pgaAreas = {}
    this.self_area = {}
    this.common_graphics = {}

    // 重置其他状态
    this.agent_graphics = []
    // 如需也可清空路径数据：this.map_path_info = {}
    // 强制渲染一次，确保界面立即更新
    try {
      if (this.app && this.app.renderer) this.app.renderer.render(this.app.stage)
    } catch (e) {
      console.warn('clearDynamicData: render failed', e)
    }

    console.log('clearDynamicData: done')
  }
  // ...existing code...

  // 坐标变换，屏幕坐标转为地图坐标, 注意 pixijs 的变换顺序是 缩放、旋转、平移
  // 考虑地图坐标 (raw_x, raw_y) 则点击位置 (x, y) 与原位置的关系为：
  // x = rotate(raw_x * scale) + offset_x
  // 逆运算即可算出原坐标

  raw_xy(x, y) {
    const scale = this.mainContainer.scale.x

    const _x = x - this.mainContainer.position.x
    const _y = y - this.mainContainer.position.y

    const newPoint = unrotatePoint(_x, _y, this.g_rotation)

    const t_x = newPoint.x / scale
    let t_y = newPoint.y / scale
    t_y = -t_y // 前端 y 的方向与原地图相反
    return [roundTo(t_x, 4), roundTo(t_y, 4)]
  }


  add_agent(vehicle_id) {
    const v = new Agent(this, vehicle_id)
    // this.agent_graphics.push(v.graphics)
    v.graphics.interactive = true
    v.graphics.cursor = 'pointer'
    v.graphics.eventMode = 'static'

    this.agents[vehicle_id] = v

    v.graphics.on('pointerdown', (e) => {
      if (e.button === 2) {
        e.stopPropagation()
        const rect = this.app.canvas.getBoundingClientRect()
        const clientX = typeof e.clientX === 'number' ? e.clientX : rect.left + e.global.x
        const clientY = typeof e.clientY === 'number' ? e.clientY : rect.top + e.global.y
        window.dispatchEvent(
          new CustomEvent('vehicle-contextmenu', {
            detail: { vehicleId: vehicle_id, x: clientX, y: clientY },
          }),
        )
      }
    })

    // 添加鼠标悬停事件处理，显示车辆信息
    v.graphics.on('pointerover', (e) => {
      // 高亮显示车辆
      v.graphics.tint = 0xffffff // 亮白色

      // 创建tooltip内容
      const agent = this.agents[vehicle_id]
      const priorityInfo =
        agent.v_info.priority !== null && agent.v_info.priority !== undefined
          ? ` (${agent.v_info.priority})`
          : ''
      const tooltipContent = `
        <div style="font-weight: bold; margin-bottom: 4px;">Vehicle Info</div>
        <div>id: ${agent.vehicle_id}${priorityInfo}</div>
        <div>pose: ${agent.position.x.toFixed(3)}, ${-agent.position.y.toFixed(3)}, ${agent.position.theta.toFixed(3)}</div>
        <div>blocked_by: ${agent.v_info.blocked_by}</div>
        <div>block: ${agent.v_info.block}</div>
        ${agent.v_info.priority !== null && agent.v_info.priority !== undefined ? `<div>priority: ${agent.v_info.priority}</div>` : ''}
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

    // console.log('add graphics1: ', v)
    // console.log('add graphics2: ', v.graph_long_path)

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
  setManualPathMode(active: boolean) {
    this.manualPathState.active = active
    this.manualPathState.dragging = false
    this.manualPathState.startPoint = null
    if (active) {
      this.mouse_func = 'manual_path'
    } else if (this.parkingPathState.active) {
      this.mouse_func = 'parking_path'
    } else {
      this.mouse_func = 'default'
    }
    if (!active) {
      this.clearManualPathPreview()
      this.clearManualPathArrow()
    }
  }

  setParkingPathMode(active: boolean) {
    this.parkingPathState.active = active
    this.parkingPathState.dragging = false
    this.parkingPathState.startPoint = null
    if (active) {
      this.mouse_func = 'parking_path'
    } else if (this.manualPathState.active) {
      this.mouse_func = 'manual_path'
    } else {
      this.mouse_func = 'default'
    }
    if (!active) {
      this.clearParkingPathPreview()
      this.clearParkingPathArrow()
      this.clearParkingObstacles()
    }
  }

  handleManualPathPointerDown(e) {
    if (!this.manualPathState.active) return
    if (e.button !== 0) return
    const [x, y] = this.raw_xy(e.global.x, e.global.y)
    const snapped = this.snapManualPathTarget(x, y, 0)
    const startX = snapped?.x ?? x
    const startY = snapped?.y ?? y
    this.manualPathState.dragging = true
    this.manualPathState.startPoint = { x: startX, y: startY, theta: 0 }
    this.updateManualPathArrow(startX, startY, 0)
  }

  handleParkingPathPointerDown(e) {
    if (!this.parkingPathState.active) return
    if (e.button !== 0) return
    const [x, y] = this.raw_xy(e.global.x, e.global.y)
    this.clearParkingPathPreview()
    this.parkingPathState.dragging = true
    this.parkingPathState.startPoint = { x, y, theta: 0 }
    this.updateParkingPathArrow(x, y, 0)
  }

  handleManualPathPointerMove(e) {
    if (!this.manualPathState.active || !this.manualPathState.dragging) return
    const start = this.manualPathState.startPoint
    if (!start) return
    const [x, y] = this.raw_xy(e.global.x, e.global.y)
    const heading = Math.atan2(y - start.y, x - start.x)
    this.updateManualPathArrow(start.x, start.y, heading)
  }

  handleParkingPathPointerMove(e) {
    if (!this.parkingPathState.active || !this.parkingPathState.dragging) return
    const start = this.parkingPathState.startPoint
    if (!start) return
    const [x, y] = this.raw_xy(e.global.x, e.global.y)
    const heading = Math.atan2(y - start.y, x - start.x)
    this.updateParkingPathArrow(start.x, start.y, heading)
  }

  handleManualPathPointerUp(e) {
    if (!this.manualPathState.active || !this.manualPathState.dragging) return
    const start = this.manualPathState.startPoint
    if (!start) return
    const [x, y] = this.raw_xy(e.global.x, e.global.y)
    const heading = Math.atan2(y - start.y, x - start.x)
    const snapped = this.snapManualPathTarget(start.x, start.y, heading)
    const target = snapped ?? { x: start.x, y: start.y, heading }
    this.manualPathState.dragging = false
    this.manualPathState.startPoint = null
    this.clearManualPathArrow()
    window.dispatchEvent(
      new CustomEvent('manual-path-target-selected', {
        detail: target,
      }),
    )
  }

  handleParkingPathPointerUp(e) {
    if (!this.parkingPathState.active || !this.parkingPathState.dragging) return
    const start = this.parkingPathState.startPoint
    if (!start) return
    const [x, y] = this.raw_xy(e.global.x, e.global.y)
    const heading = Math.atan2(y - start.y, x - start.x)
    const target = { x: start.x, y: start.y, heading }
    this.parkingPathState.dragging = false
    this.parkingPathState.startPoint = null
    this.clearParkingPathArrow()
    window.dispatchEvent(
      new CustomEvent('parking-path-target-selected', {
        detail: target,
      }),
    )
  }

  updateManualPathArrow(x: number, y: number, heading: number) {
    if (!this.manualPathArrowGraphics) return
    const [appX, appY] = this.map_xy_to_app([x, y])
    this.manualPathArrowGraphics.clear()
    this.drawArrow(this.manualPathArrowGraphics, appX, appY, -heading, 3, '#ffaa00', 0.8)
  }

  updateParkingPathArrow(x: number, y: number, heading: number) {
    if (!this.parkingPathArrowGraphics) return
    const [appX, appY] = this.map_xy_to_app([x, y])
    this.parkingPathArrowGraphics.clear()
    this.parkingPathArrowGraphics.pivot.set(0, 0)
    this.parkingPathArrowGraphics.position.set(0, 0)
    this.parkingPathArrowGraphics.rotation = 0
    this.drawArrow(this.parkingPathArrowGraphics, appX, appY, -heading, 3, '#00c2ff', 0.8)
  }

  clearManualPathArrow() {
    if (this.manualPathArrowGraphics) {
      this.manualPathArrowGraphics.clear()
    }
  }

  clearParkingPathArrow() {
    if (this.parkingPathArrowGraphics) {
      this.parkingPathArrowGraphics.clear()
    }
  }

  updateManualPathPreview(target: { x: number; y: number; heading: number }, valid = true) {
    if (!this.manualPathPreviewGraphics) return
    const [appX, appY] = this.map_xy_to_app([target.x, target.y])
    const g = this.manualPathPreviewGraphics
    g.clear()
    const width = 16
    const height = 3.1
    g.pivot.set(appX, appY)
    g.position.set(appX, appY)
    const fillColor = valid ? '#00d60b' : '#ff4d4f'
    g.rect(-width / 2, -height / 2, width, height)
      .fill({ color: fillColor, alpha: 0.4 })
      .stroke({ color: fillColor, width: 0.6, alpha: 0.6 })
    g.rotation = -target.heading
    g.pivot.set(0, 0)
    this.drawArrow(g, 0, 0, 0, 3, fillColor, 0.5)
  }

  updateParkingPathPreviewPath(points: { x: number; y: number; heading: number }[], valid = true) {
    if (
      !this.parkingPathPreviewGraphics ||
      !this.parkingPathArrowGraphics ||
      !this.parkingPathPoseContainer ||
      points.length < 2
    )
      return
    const lineGraphics = this.parkingPathPreviewGraphics
    const markerGraphics = this.parkingPathArrowGraphics
    const poseContainer = this.parkingPathPoseContainer
    lineGraphics.clear()
    markerGraphics.clear()
    poseContainer.removeChildren()
    const lineColor = valid ? 0x00d60b : 0xff4d4f
    const poseColor = lineColor
    this.drawLine(
      lineGraphics,
      'parking-path-preview',
      points.map((point) => [point.x, point.y]),
      false,
      lineColor,
      1,
      0.8,
    )
    const width = 16
    const height = 3.1
    const maxPoseMarkers = 10
    points.slice(0, maxPoseMarkers).forEach((point) => {
      const [appX, appY] = this.map_xy_to_app([point.x, point.y])
      const rect = new Graphics()
      rect
        .rect(-width / 2, -height / 2, width, height)
        .fill({ color: poseColor, alpha: 0.18 })
        .stroke({ color: poseColor, width: 0.5, alpha: 0.4 })
      rect.position.set(appX, appY)
      rect.rotation = -point.heading
      poseContainer.addChild(rect)
    })
    const end = points[points.length - 1]
    const [appX, appY] = this.map_xy_to_app([end.x, end.y])
    markerGraphics.pivot.set(appX, appY)
    markerGraphics.position.set(appX, appY)
    markerGraphics.rect(-width / 2, -height / 2, width, height)
      .fill({ color: lineColor, alpha: 0.4 })
      .stroke({ color: lineColor, width: 0.6, alpha: 0.6 })
    markerGraphics.rotation = -end.heading
    markerGraphics.pivot.set(0, 0)
    this.drawArrow(markerGraphics, 0, 0, 0, 3, lineColor, 0.5)
  }

  clearManualPathPreview() {
    if (this.manualPathPreviewGraphics) {
      this.manualPathPreviewGraphics.clear()
    }
  }

  clearParkingPathPreview() {
    if (this.parkingPathPreviewGraphics) {
      this.parkingPathPreviewGraphics.clear()
    }
    if (this.parkingPathPoseContainer) {
      this.parkingPathPoseContainer.removeChildren()
    }
    if (this.parkingPathArrowGraphics) {
      this.parkingPathArrowGraphics.clear()
    }
  }

  updateParkingObstacles(points: { x: number; y: number }[]) {
    if (!this.parkingObstacleGraphics) return
    const g = this.parkingObstacleGraphics
    g.clear()
    points.forEach((point) => {
      const [appX, appY] = this.map_xy_to_app([point.x, point.y])
      g.circle(appX, appY, 2)
        .fill({ color: 0xff7a45, alpha: 0.8 })
        .stroke({ color: 0xff7a45, width: 0.6, alpha: 0.8 })
    })
  }

  clearParkingObstacles() {
    if (this.parkingObstacleGraphics) {
      this.parkingObstacleGraphics.clear()
    }
  }

  normalizeAngle(angle: number) {
    const twoPi = Math.PI * 2
    return ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI
  }

  projectPointToSegment(point: [number, number], start: [number, number], end: [number, number]) {
    const [px, py] = point
    const [x1, y1] = start
    const [x2, y2] = end
    const dx = x2 - x1
    const dy = y2 - y1
    if (dx === 0 && dy === 0) {
      return { x: x1, y: y1, distance: Math.hypot(px - x1, py - y1) }
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = Math.max(0, Math.min(1, t))
    const projX = x1 + t * dx
    const projY = y1 + t * dy
    return { x: projX, y: projY, distance: Math.hypot(px - projX, py - projY) }
  }

  snapManualPathTarget(x: number, y: number, heading: number) {
    const mapInfo = this.map_path_info || {}
    let bestDistance = Number.POSITIVE_INFINITY
    let bestAngleDiff = Number.POSITIVE_INFINITY
    let bestPoint: { x: number; y: number; heading: number } | null = null

    Object.entries(mapInfo).forEach(([laneId, laneInfo]) => {
      if (laneId.startsWith('junction_')) return
      const points = laneInfo?.points || []
      if (points.length < 2) return

      for (let i = 0; i < points.length - 1; i += 1) {
        const [x1, y1] = points[i]
        const [x2, y2] = points[i + 1]
        const projection = this.projectPointToSegment([x, y], [x1, y1], [x2, y2])
        const laneHeading = Math.atan2(y2 - y1, x2 - x1)
        const angleDiff = Math.abs(this.normalizeAngle(heading - laneHeading))
        const distanceDelta = Math.abs(projection.distance - bestDistance)
        if (
          projection.distance < bestDistance ||
          (distanceDelta <= 0.5 && angleDiff < bestAngleDiff)
        ) {
          bestDistance = projection.distance
          bestAngleDiff = angleDiff
          bestPoint = {
            x: projection.x,
            y: projection.y,
            heading: laneHeading,
          }
        }
      }
    })

    if (!bestPoint || bestDistance > 10) return null

    const oppositeHeading = this.normalizeAngle(bestPoint.heading + Math.PI)
    const directDiff = Math.abs(this.normalizeAngle(heading - bestPoint.heading))
    const oppositeDiff = Math.abs(this.normalizeAngle(heading - oppositeHeading))
    const snappedHeading = oppositeDiff < directDiff ? oppositeHeading : bestPoint.heading

    return {
      x: bestPoint.x,
      y: bestPoint.y,
      heading: snappedHeading,
    }
  }
  calculateAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1)
  }
  matchIntNumber(s: string): number {
    if (!s) return 0;
    // 提取字符串中的第一组连续数字
    const match = s.match(/\d+/); // 匹配第一个连续数字
    return match ? parseInt(match[0], 10) : 0;
  }

  // 根据路径信息绘制主界面路径，在路径中点加上箭头
  draw_map_road(g, points, color, alpha = 0.5, width = 1) {
    // const width = 1
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

  async initMap(vpb_info) {
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

    const vpb_enter_list = vpb_info?.vpb_enter?.map(item => this.matchIntNumber(item)).filter(num => num > 0) || [];
    const vpb_exit_list = vpb_info?.vpb_exit?.map(item => this.matchIntNumber(item)).filter(num => num > 0) || [];


    Object.entries(this.map_path_info).forEach(([path_id, one_path]) => {
      let color = '#fff'

      if (!getGlobalSettings().value.all_vpb_show) {
        // 检查是否有vpb_enter或vpb_exit属性
        const vpb_enter = this.matchIntNumber(one_path?.attrs?.vpb_enter)
        const vpb_exit = this.matchIntNumber(one_path?.attrs?.vpb_exit)
        if (vpb_enter && vpb_enter_list && !vpb_enter_list.includes(vpb_enter)) {
          return;
        }
        if (vpb_exit && vpb_exit_list && !vpb_exit_list.includes(vpb_exit)) {
          return;
        }
        // vpb color
        if (vpb_enter) { color = "blue" }
        if (vpb_exit) { color = "red" }
      }

      // console.log(path_id, one_path);
      const points = one_path['points']

      const g = new Graphics()
      cons.addChild(g)




      // 直接使用 drawLine 方法
      this.draw_map_road(g, points, color, 0.4)

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
            'vpb_enter',
            'vpb_exit',
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
        this.draw_map_road(g, points, color)
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
    const the_x = e.global.x - graphic.position.x
    const the_y = e.global.y - graphic.position.y

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

    // 更新车辆 id 文本的位置
    Object.values(this.agents).forEach((agent) => {
      agent.sync_text_pos(agent.position.x, agent.position.y)
    })

    // 更新流控区域的文本位置
    this.limitAreaTextContainer.children.forEach((limit_text) => {
      limit_text.__ww_update()
    })

    // console.log('main container: ', this.mainContainer.position, this.mainContainer.scale.x)
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
    }
  }

  map_xy_to_app(point) {
    return [point[0], -point[1]]
  }

  // 设置画框处理器（由LockArea.vue调用）
  setDrawingHandlers(handlers) {
    this.drawingHandlers = handlers
  }

  // 切换背景图片显示状态
  toggleBackgroundImage(visible: boolean) {
    if (this.backgroundSprite) {
      this.backgroundImageConfig.visible = visible
      this.backgroundSprite.visible = this.backgroundImageConfig.visible
      console.log('背景图片显示状态:', this.backgroundImageConfig.visible ? '显示' : '隐藏')
    }
  }

  // 获取背景图片显示状态
  getBackgroundImageVisible() {
    return this.backgroundImageConfig.visible
  }

  // 更新时间显示
  updateTimeDisplay() {
    if (this.timeText) {
      // 回放模式下顶部时间显示规则：
      // 1) 回放中且已选择文件：显示 [RE] + 回放时间点
      // 2) 回放中但未选择文件：仅显示 [RE]
      // 3) 非回放：显示实时时间

      const globalStore = useGlobalStore()

      if (globalStore.isReplay) {
        const t = globalStore.replayCurrentTime
        const hasFile = !!globalStore.replaySelectedFile

        if (!hasFile) {
          this.timeText.text = '[RE]'
          return
        }

        if (t) {
          const timeString = dayjs(t).format('YYYY-MM-DD HH:mm:ss')
          this.timeText.text = `[RE] ${timeString}`
        } else {
          // 已选择文件但时间点尚未设置（例如刚切换模式/刚选文件）
          this.timeText.text = '[RE]'
        }
        return
      }
      this.timeText.text = dayjs(Date()).format('YYYY-MM-DD HH:mm:ss')
    }
  }

  /**
   * 地图坐标转换为屏幕坐标，附加自定义偏移量
   * raw_xy 的逆操作
   * @param p 地图坐标 [x, y]
   * @param offset 偏移量 [offsetX, offsetY]，默认 [5, -5]
   * @returns 屏幕坐标 [screenX, screenY]
   */
  map_to_screen_xy(p: [number, number], offset: [number, number] = [0, 0], reverse_y = false): [number, number] {

    let [x, y] = p
    const scale = this.mainContainer.scale.x
    const rotation = this.g_rotation
    const baseOffsetX = this.mainContainer.position.x
    const baseOffsetY = this.mainContainer.position.y
    if (reverse_y){
      y = -y // y 轴反转
    }
    x += offset[0]
    y += offset[1]

    // 1. 先缩放
    let screenX = x * scale
    let screenY = y * scale

    // 2. 再旋转
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const rotatedX = screenX * cos - screenY * sin
    const rotatedY = screenX * sin + screenY * cos

    // 3. 最后平移
    screenX = rotatedX + baseOffsetX
    screenY = rotatedY + baseOffsetY
    return [screenX, screenY]
  }

  // 更新车辆的显示状态, 包括: 车辆轮廓, id, 短路径, 长路径, selfarea, ga, pga, pla.
  update_agent_visibility(vehicle_id: string) {
    const agent = this.agents[vehicle_id]
    if (!agent) return;

    const settingsStore = getSettingsStore()
    const globalSettings = getGlobalSettings()

    if (!(vehicle_id in globalSettings.value.vehicle_visible)) {
      settingsStore.updateVehicleVisible(vehicle_id, true);
      // globalSettings.value.vehicle_visible[vehicle_id] = true;
    }

    const visible = settingsStore.getVehicleVisible(vehicle_id) // globalSettings.value.vehicle_visible[vehicle_id]

    // console.log('更新车辆的显示状态:', vehicle_id, visible)

    agent.visible = visible
    agent.graphics.visible = visible
    agent.text.visible = visible && globalSettings.value.vehicle_allIDsVisible
    agent.graph_short_path.visible = visible && globalSettings.value.vehicle_allShortPathsVisible
    agent.graph_long_path.visible = visible && globalSettings.value.vehicle_allLongPathsVisible

    // area : let areaGraphics = this.manager[data_key]?.[areaId]
    const g_self_area = this.self_area?.[vehicle_id]
    if (g_self_area) {
      g_self_area.visible = visible && globalSettings.value.vehicle_selfAreaVisible
    }

    // ga
    const ga = this.gaAreas?.[vehicle_id]
    if (ga) {
      ga.visible = visible && globalSettings.value.vehicle_gaAreasVisible
    }

    // pga
    const pga = this.pgaAreas?.[vehicle_id]
    if (pga) {
      pga.visible = visible && globalSettings.value.vehicle_pgaAreasVisible
    }

    // pla
    const pla = this.plaAreas?.[vehicle_id]
    if (pla) {
      pla.visible = visible && globalSettings.value.vehicle_plaAreasVisible
    }

  }
}
