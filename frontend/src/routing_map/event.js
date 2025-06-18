export class EventManager {
  constructor(app, manager) {
    this.app = app;
    this.manager = manager;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.rafId = null;
  }

  setupEventListeners() {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    // 设置事件处理器
    const pointerDownHandler = this.handlePointerDown.bind(this);
    const pointerMoveHandler = this.handlePointerMove.bind(this);
    const pointerUpHandler = this.handlePointerUp.bind(this);
    const pointerUpOutsideHandler = this.handlePointerUpOutside.bind(this);
    const wheelHandler = this.handleWheel.bind(this);

    // 添加事件监听器
    this.app.stage.addEventListener('pointerdown', pointerDownHandler);
    this.app.stage.addEventListener('pointermove', pointerMoveHandler);
    this.app.stage.addEventListener('pointerup', pointerUpHandler);
    this.app.stage.addEventListener('pointerupoutside', pointerUpOutsideHandler);
    this.app.stage.addEventListener('wheel', wheelHandler);

    // 添加文档级别的事件监听器
    document.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

    // 设置UI控件事件监听器
    this.setupUIControls();

    // 记录所有事件监听器用于清理
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointerdown',
      listener: pointerDownHandler
    });
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointermove',
      listener: pointerMoveHandler
    });
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointerup',
      listener: pointerUpHandler
    });
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'pointerupoutside',
      listener: pointerUpOutsideHandler
    });
    this.manager.addCleanupTask('eventListeners', {
      target: this.app.stage,
      type: 'wheel',
      listener: wheelHandler
    });
  }

  handlePointerDown(e) {
    this.isDragging = true;
    this.lastX = e.global.x;
    this.lastY = e.global.y;

    let raw_pos = this.manager.raw_xy(e.global.x, e.global.y);
    console.log('click-pos', raw_pos);

    const clickPosElement = document.getElementById('click-pos');
    if (clickPosElement) {
      clickPosElement.innerHTML = `click: [${raw_pos[0]}, ${raw_pos[1]}]`;
    }
  }

  handlePointerMove(e) {
    // 更新指针位置显示
    let raw_pos = this.manager.raw_xy(e.global.x, e.global.y);
    const realtimePosElement = document.getElementById('realtime-pos');
    if (realtimePosElement) {
      realtimePosElement.innerHTML = `pointer: [${raw_pos[0]}, ${raw_pos[1]}]`;
    }

    // 拖动处理 - 使用requestAnimationFrame优化性能
    if (this.isDragging) {
      if (this.rafId) cancelAnimationFrame(this.rafId);

      this.rafId = requestAnimationFrame(() => {
        const off_x = e.global.x - this.lastX;
        const off_y = e.global.y - this.lastY;

        this.manager.move_all_things(off_x, off_y);

        this.lastX = e.global.x;
        this.lastY = e.global.y;
        this.rafId = null;
      });
    }
  }

  handlePointerUp() {
    this.isDragging = false;
  }

  handlePointerUpOutside() {
    this.isDragging = false;
  }

  handleWheel(e) {
    console.log('zoom in/out', e.deltaY);
    console.log(e.clientX, e.clientY);
    console.log('position');

    let scale_level = 1.3;
    let scale_level_v = scale_level;

    if (e.deltaY < 0) {
      // zoom in
    } else {
      // zoom out
      scale_level_v = 1 / scale_level;
    }

    this.manager.graphics_sacle_move(e, this.manager.mainContainer, scale_level_v);
    console.log('now scale', this.manager.mainContainer.scale.x);
  }

  setupUIControls() {
    const map_hide = document.getElementById('map_hide');
    const smooth_toggle = document.getElementById('smooth_toggle');
    const smooth_speed = document.getElementById('smooth_speed');

    // 使用事件委托处理 map_hide 按钮点击
    // 将事件监听器绑定到 document 上，这样即使按钮被重新创建也能工作
    const handleMapHideClick = (e) => {
      if (e.target && e.target.id === 'map_hide') {
        this.manager.map_container.visible = !this.manager.map_container.visible;
      }
    };

    document.addEventListener('click', handleMapHideClick);

    // 记录清理任务
    this.manager.addCleanupTask('eventListeners', {
      target: document,
      type: 'click',
      listener: handleMapHideClick
    });

    // 平滑移动控制
    if (smooth_toggle) {
      smooth_toggle.checked = this.manager.smoothMovementConfig.enabled;
      smooth_toggle.addEventListener('change', (e) => {
        this.manager.smoothMovementConfig.enabled = e.target.checked;
      });
    }

    // 平滑移动速度控制
    if (smooth_speed) {
      smooth_speed.value = this.manager.smoothMovementConfig.speed * 100;
      smooth_speed.addEventListener('input', (e) => {
        this.manager.smoothMovementConfig.speed = e.target.value / 100;
        // 更新所有车辆的动画速度
        for (const agent of Object.values(this.manager.agents)) {
          agent.animationSpeed = this.manager.smoothMovementConfig.speed;
        }
      });
    }
  }
}
