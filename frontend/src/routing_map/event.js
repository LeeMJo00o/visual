import { useGlobalStore } from '../stores/globalStore'

/**
 * @typedef {import('./main.ts').default} ApplicationManager
 */

export class EventManager {
  /**
   * @param {any} app - PIXI应用实例
   * @param {ApplicationManager} manager - 主应用管理器实例
   */
  constructor(app, manager) {
    this.app = app
    this.manager = manager
    this.isDragging = false
    this.lastX = 0
    this.lastY = 0
    this.rafId = null
    this.globalStore = useGlobalStore()
  }

  setupEventListeners() {
    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea = this.app.screen

    // 设置事件处理器
    const pointerDownHandler = this.handlePointerDown.bind(this)
    const pointerMoveHandler = this.handlePointerMove.bind(this)
    const pointerUpHandler = this.handlePointerUp.bind(this)
    const pointerUpOutsideHandler = this.handlePointerUpOutside.bind(this)
    const wheelHandler = this.handleWheel.bind(this)

    // 添加事件监听器
    this.app.stage.addEventListener('pointerdown', pointerDownHandler)
    this.app.stage.addEventListener('pointermove', pointerMoveHandler)
    this.app.stage.addEventListener('pointerup', pointerUpHandler)
    this.app.stage.addEventListener('pointerupoutside', pointerUpOutsideHandler)
    this.app.stage.addEventListener('wheel', wheelHandler)

    // 添加文档级别的事件监听器
    // document.addEventListener('wheel', (e) => e.preventDefault(), { passive: false })

    // 设置UI控件事件监听器
    this.setupUIControls()
  }

  handlePointerDown(e) {
    // 只在默认模式下执行拖拽功能
    if (this.manager.mouse_func === 'default') {
      this.isDragging = true
      this.lastX = e.global.x
      this.lastY = e.global.y

      let raw_pos = this.manager.raw_xy(e.global.x, e.global.y)
      // 使用Pinia store更新
      this.globalStore.setPosition('click', raw_pos[0], raw_pos[1])
    } else if (this.manager.mouse_func === 'draw' && this.manager.drawingHandlers) {
      this.manager.drawingHandlers.handleDrawingMouseDown(e)
    }
  }

  handlePointerMove(e) {
    // 只在默认模式下执行拖拽功能
    if (this.manager.mouse_func === 'default') {
      let raw_pos = this.manager.raw_xy(e.global.x, e.global.y)
      // 使用Pinia store更新
      this.globalStore.setPosition('pointer', raw_pos[0], raw_pos[1])

      if (this.isDragging) {
        if (this.rafId) cancelAnimationFrame(this.rafId)
        this.rafId = requestAnimationFrame(() => {
          const off_x = e.global.x - this.lastX
          const off_y = e.global.y - this.lastY
          this.manager.move_all(off_x, off_y)
          this.lastX = e.global.x
          this.lastY = e.global.y
          this.rafId = null
        })
      }
    } else if (this.manager.mouse_func === 'draw' && this.manager.drawingHandlers) {
      this.manager.drawingHandlers.handleDrawingMouseMove(e)
    }
  }

  handleWheel(e) {
    console.log('zoom in/out', e.deltaY)
    console.log(e.clientX, e.clientY)
    console.log('position')

    let scale_level = 1.3
    let scale_level_v = scale_level

    if (e.deltaY < 0) {
      // zoom in
    } else {
      // zoom out
      scale_level_v = 1 / scale_level
    }

    this.manager.graphics_sacle_move(e, scale_level_v)
    console.log('now scale', this.manager.mainContainer.scale.x)
  }
  handleWheel2(e) {
    console.log('zoom in/out', e.deltaY)
    console.log(e.clientX, e.clientY)
    console.log('position')

    let scale_level = 1.001
    let scale_level_v = scale_level

    if (e.deltaY < 0) {
      // zoom in
    } else {
      // zoom out
      scale_level_v = 1 / scale_level
    }

    this.manager.graphics_sacle_move(e, scale_level_v)
    console.log('now scale', this.manager.mainContainer.scale.x)
  }
  handlePointerUp(e) {
    // 只在默认模式下执行拖拽功能
    if (this.manager.mouse_func === 'default') {
      this.isDragging = false
    } else if (this.manager.mouse_func === 'draw' && this.manager.drawingHandlers) {
      this.manager.drawingHandlers.handleDrawingMouseUp(e)
    }
  }

  handlePointerUpOutside(e) {
    // 只在默认模式下执行拖拽功能
    if (this.manager.mouse_func === 'default') {
      this.isDragging = false
    } else if (this.manager.mouse_func === 'draw' && this.manager.drawingHandlers) {
      this.manager.drawingHandlers.handleDrawingMouseUp(e)
    }
  }

  setupUIControls() {
    // 只保留自定义事件监听，删除原生button相关事件委托
    // window.addEventListener('map-hide-click', ...)
    // window.addEventListener('agent-hide-click', ...)
    
    // window.addEventListener('map-hide-click', () => {
    //   this.manager.map_container.visible = !this.manager.map_container.visible
    // })
    window.addEventListener('agent-hide-click', () => {
      Object.values(this.manager.agents).forEach((agent) => {
        if (agent.graphics) agent.graphics.visible = !agent.graphics.visible
        if (agent.graph_short_path) agent.graph_short_path.visible = !agent.graph_short_path.visible
        if (agent.graph_long_path) agent.graph_long_path.visible = !agent.graph_long_path.visible
        if (agent.text) agent.text.visible = !agent.text.visible
      })
    })
    // window.addEventListener('image-hide-click', () => {
    //   this.manager.toggleBackgroundImage()
    // })

    // self_area

    window.addEventListener('self_area_visible', () => {
      Object.values(this.manager.self_area).forEach((agent) => {
        if (agent) agent.visible = !agent.visible
      })
    })
    // ga_area
    window.addEventListener('ga_area_visible', () => {
      Object.values(this.manager.gaAreas).forEach((agent) => {
        if (agent) agent.visible = !agent.visible
      })
    })
    // pga_area
    window.addEventListener('pga_area_visible', () => {
      Object.values(this.manager.pgaAreas).forEach((agent) => {
        if (agent) agent.visible = !agent.visible
      })
    })
    // pla_area
    window.addEventListener('pla_area_visible', () => {
      Object.values(this.manager.plaAreas).forEach((agent) => {
        if (agent) agent.visible = !agent.visible
      })
    })
  }
}
