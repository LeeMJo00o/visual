import { useGlobalStore } from '../stores/globalStore'

/**
 * @typedef {import('./main.js').default} ApplicationManager
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
    document.addEventListener('wheel', (e) => e.preventDefault(), { passive: false })

    // 设置UI控件事件监听器
    this.setupUIControls()

    // 记录所有事件监听器用于清理
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointerdown',
      listener: pointerDownHandler,
    })
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointermove',
      listener: pointerMoveHandler,
    })
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointerup',
      listener: pointerUpHandler,
    })
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointerupoutside',
      listener: pointerUpOutsideHandler,
    })
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'wheel',
      listener: wheelHandler,
    })
  }

  handlePointerDown(e) {
    this.isDragging = true
    this.lastX = e.global.x
    this.lastY = e.global.y

    let raw_pos = this.manager.raw_xy(e.global.x, e.global.y)
    // 使用Pinia store更新
    this.globalStore.setPosition('click', raw_pos[0], raw_pos[1])
  }

  handlePointerMove(e) {
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

  handlePointerUp() {
    this.isDragging = false
  }

  handlePointerUpOutside() {
    this.isDragging = false
  }

  setupUIControls() {
    // 只保留自定义事件监听，删除原生button相关事件委托
    // window.addEventListener('map-hide-click', ...)
    // window.addEventListener('agent-hide-click', ...)
    window.addEventListener('map-hide-click', () => {
      this.manager.map_container.visible = !this.manager.map_container.visible
    })
    window.addEventListener('agent-hide-click', () => {
      Object.values(this.manager.agents).forEach((agent) => {
        if (agent.graphics) agent.graphics.visible = !agent.graphics.visible
        if (agent.graph_short_path) agent.graph_short_path.visible = !agent.graph_short_path.visible
        if (agent.graph_long_path) agent.graph_long_path.visible = !agent.graph_long_path.visible
        if (agent.text) agent.text.visible = !agent.text.visible
      })
    })
  }
}
