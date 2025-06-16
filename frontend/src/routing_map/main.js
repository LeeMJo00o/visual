import { Application, Assets, Graphics, Text, Texture, Sprite, Container } from 'pixi.js'
import { GraphicTools, stringToUniqueColor, unrotatePoint } from './graph.js'
import { WebSocketClient, demo_get_traj, get_svg_content, get_map_config, get_path_info } from './pp_backend.js'
import { mapCache } from './map_cache.js'  // 导入缓存模块
import { EventManager } from './event.js'  // 导入事件管理器

const roundTo = (num, decimalPlaces) =>
  Math.round(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)

class Agent {
  constructor(manager, vehicle_id) {
    this.graphics = new Graphics()
    this.manager = manager
    this.w = 18
    this.h = 7
    this.vehicle_id = vehicle_id

    // 添加位置信息属性，用于tooltip显示
    this.position = {
      x: 0,
      y: 0,
      theta: 0
    }

    // 添加目标位置和动画状态，用于平滑移动
    this.targetPosition = {
      x: 0,
      y: 0,
      theta: 0
    }

    // 是否正在动画中
    this.isAnimating = false
    // 动画速度因子（较大的值 = 更快的移动）
    this.animationSpeed = 0.05
    // 用于检测位置是否足够接近目标的阈值
    this.positionThreshold = 0.01

    this.text = new Text({
      text: this.vehicle_id,
      style: {
        fontSize: 12,
      },
    })
    this.color = stringToUniqueColor(vehicle_id)
    // this.color_head = '#2570e8'
    this.color_head = '#00d60b'

    this.graph_short_path = new Graphics()
    this.graph_long_path = new Graphics()

  }

  sync_text_pos(x, y) {
    let scale = this.manager.g_scale;
    this.text.position.set(x, y)
    this.text.rotation = -this.manager.g_rotation
  }

  // 新方法：在每一帧更新位置
  update() {
    if (!this.isAnimating) return;

    // 计算当前位置到目标位置的差距
    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    let dTheta = this.targetPosition.theta - this.position.theta;

    // 处理角度变化可能超过180度的情况（确保旋转走最短路径）
    if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    if (dTheta < -Math.PI) dTheta += 2 * Math.PI;

    // 检查是否已经足够接近目标
    if (Math.abs(dx) < this.positionThreshold &&
      Math.abs(dy) < this.positionThreshold &&
      Math.abs(dTheta) < this.positionThreshold) {
      // 如果很接近，直接设置到目标位置
      this.position = { ...this.targetPosition };
      this._updateGraphics();
      this.isAnimating = false;
      return;
    }

    // 否则，向目标位置移动一小步
    this.position.x += dx * this.animationSpeed;
    this.position.y += dy * this.animationSpeed;
    this.position.theta += dTheta * this.animationSpeed;

    // 更新图形
    this._updateGraphics();
  }

  setPosition(x, y, theta) {
    // 设置目标位置，而不是直接更新
    this.targetPosition = {
      x: roundTo(x, 4),
      y: roundTo(y, 4),
      theta: roundTo(theta, 4)
    }

    // 标记动画开始
    this.isAnimating = true

    // 如果是首次设置位置，直接更新到目标位置（无需动画）
    if (this.position.x === 0 && this.position.y === 0 && this.position.theta === 0) {
      this.position = { ...this.targetPosition };
      this._updateGraphics();
      this.isAnimating = false;
    }
  }

  // 新方法：更新图形显示
  _updateGraphics() {
    this.graphics.clear()

    let mid_v = 3 / 4
    let x_t = -this.w * mid_v
    let y_t = -this.h / 2

    this.sync_text_pos(this.position.x, this.position.y)

    let _x = this.position.x //+ this.manager.mainContainer.position.x
    let _y = this.position.y //+ this.manager.mainContainer.position.y

    this.graphics.pivot.set(_x, _y)
    this.graphics.position.set(_x, _y)

    this.graphics.rect(x_t, y_t, this.w, this.h)
    this.graphics.stroke({ color: this.color, width: 1 })

    this.graphics.moveTo(0, -this.h / 2)
    this.graphics.lineTo(0, this.h / 2)

    // this.graphics.moveTo(this.w * (1 - mid_v), -this.h / 2)
    // this.graphics.lineTo(this.w * (1 - mid_v), this.h / 2)

    this.graphics.stroke({ color: this.color_head, width: 1 })
    this.graphics.rotation = -this.position.theta

    this.graphics.pivot.set(0, 0)

    // console.log("update pos:", this.vehicle_id, this.position.x, this.position.y);
  }
}

export default class ApplicationManager extends GraphicTools {
  constructor() {
    super()
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
    this.mode = "test-demo"

    // 车辆平滑移动的配置
    this.smoothMovementConfig = {
      enabled: true,        // 是否启用平滑移动
      speed: 0.1,           // 动画速度因子（较大的值 = 更快的移动）
      threshold: 0.01       // 用于检测位置是否足够接近目标的阈值
    }

    // 创建全局tooltip元素
    this.tooltip = null

    // 存储所有需要清理的资源
    this.cleanupTasks = {
      intervals: [],      // 存储所有setInterval的ID
      timeouts: [],       // 存储所有setTimeout的ID
      eventListeners: [], // 存储所有事件监听器
      tickerCallbacks: [], // 存储所有ticker回调
      websockets: [],     // 存储所有WebSocket连接
    }

    // 创建事件管理器实例
    this.eventManager = null
  }

  // 添加需要清理的资源
  addCleanupTask(type, task) {
    if (this.cleanupTasks[type]) {
      this.cleanupTasks[type].push(task)
    }
  }

  // 清理所有资源
  cleanup() {
    console.log('开始清理资源...')

    // 清理所有定时器
    this.cleanupTasks.intervals.forEach(id => {
      clearInterval(id)
    })
    this.cleanupTasks.timeouts.forEach(id => {
      clearTimeout(id)
    })

    // 清理所有事件监听器
    this.cleanupTasks.eventListeners.forEach(({ target, type, listener }) => {
      if (target && target.removeEventListener) {
        target.removeEventListener(type, listener)
      }
    })

    // 清理所有ticker回调
    this.cleanupTasks.tickerCallbacks.forEach(callback => {
      if (this.app && this.app.ticker) {
        this.app.ticker.remove(callback)
      }
    })

    // 关闭所有WebSocket连接
    this.cleanupTasks.websockets.forEach(ws => {
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close()
      }
    })

    // 清理所有agents
    Object.values(this.agents).forEach(agent => {
      if (agent.graphics) {
        agent.graphics.destroy({ children: true })
      }
      if (agent.text) {
        agent.text.destroy()
      }
      if (agent.graph_short_path) {
        agent.graph_short_path.destroy()
      }
      if (agent.graph_long_path) {
        agent.graph_long_path.destroy()
      }
    })
    this.agents = {}

    // 清理所有图形对象
    if (this.graphics_path_short) {
      this.graphics_path_short.destroy()
    }
    if (this.graphics_path_long) {
      this.graphics_path_long.destroy()
    }
    if (this.graphics_path_apply_area) {
      this.graphics_path_apply_area.destroy()
    }
    if (this.graphics_lock_area) {
      this.graphics_lock_area.destroy()
    }

    // 清理地图容器
    if (this.map_container) {
      this.map_container.destroy({ children: true })
    }

    // 清理主容器
    if (this.mainContainer) {
      this.mainContainer.destroy({ children: true })
    }

    // 清理PIXI应用
    if (this.app) {
      this.app.destroy(true, { children: true })
    }

    // 清理tooltip
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip)
    }

    // 清空清理任务列表
    Object.keys(this.cleanupTasks).forEach(key => {
      this.cleanupTasks[key] = []
    })

    mapCache.close()

    console.log('资源清理完成')
  }

  // 坐标变换，注意 pixijs 的变换顺序是 缩放、旋转、平移
  // 考虑地图坐标 (raw_x, raw_y) 则点击位置 (x, y) 与原位置的关系为：
  // x = rotate(raw_x * scale) + offset_x
  // 逆运算即可算出原坐标

  raw_xy(x, y) {
    let scale = this.mainContainer.scale.x;

    let _x = x - this.mainContainer.position.x
    let _y = y - this.mainContainer.position.y

    let newPoint = unrotatePoint(_x, _y, this.g_rotation)

    let t_x = newPoint.x / scale
    let t_y = newPoint.y / scale
    t_y = -t_y  // 前端 y 的方向与原地图相反
    return [roundTo(t_x, 4), roundTo(t_y, 4)]
  }

  add_agent(vehicle_id, x = 0, y = 0, theta = 0) {
    console.log('add agent:', vehicle_id, x, y, theta)
    let v = new Agent(this, vehicle_id)
    // this.agent_graphics.push(v.graphics)
    v.graphics.interactive = true
    v.graphics.cursor = 'pointer'

    // 应用平滑移动配置
    v.animationSpeed = this.smoothMovementConfig.speed
    v.positionThreshold = this.smoothMovementConfig.threshold

    this.agents[vehicle_id] = v
    this.agents[vehicle_id].setPosition(x, y, theta)

    // 添加鼠标悬停事件处理，显示车辆信息
    v.graphics.on('pointerover', (e) => {
      // 高亮显示车辆
      v.graphics.tint = 0xFFFFFF; // 亮白色

      // 创建tooltip内容
      const agent = this.agents[vehicle_id];
      const tooltipContent = `
        vehicle_id: ${agent.vehicle_id}<br>
        x: ${agent.position.x}<br>
        y: ${agent.position.y}<br>
        angle: ${agent.position.theta}
      `;

      // 显示tooltip
      if (this.tooltip) {
        this.tooltip.innerHTML = tooltipContent;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = e.clientX + 15 + 'px';
        this.tooltip.style.top = e.clientY + 10 + 'px';

        // 跟随鼠标移动
        const onMouseMove = (moveEvent) => {
          this.tooltip.style.left = moveEvent.clientX + 15 + 'px';
          this.tooltip.style.top = moveEvent.clientY + 10 + 'px';
        };

        document.addEventListener('mousemove', onMouseMove);

        // 鼠标离开时移除事件监听
        v.graphics.on('pointerout', () => {
          document.removeEventListener('mousemove', onMouseMove);
          this.tooltip.style.display = 'none';
          v.graphics.tint = 0xFFFFFF; // 恢复正常颜色
        });
      }
    });

    console.log('add graphics1: ', v)
    console.log('add graphics2: ', v.graph_long_path)
    this.add_graphics(v.graph_short_path)
    this.add_graphics(v.graph_long_path)
    this.add_graphics(v.graphics)
    // this.add_graphics(v.text)

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
    this.mainContainer = new Container();

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

      // 等待initMap完成
      this.map_container = await this.initMap()

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

      this.app.stage.addChild(this.mainContainer);

      this.graphics_path_short = new Graphics()
      this.graphics_path_long = new Graphics()
      this.graphics_path_apply_area = new Graphics()
      this.graphics_lock_area = new Graphics()

      this.add_graphics(this.map_container)
      this.add_graphics(this.graphics_path_long)
      this.add_graphics(this.graphics_path_short)
      this.add_graphics(this.graphics_path_apply_area)
      this.add_graphics(this.graphics_lock_area)

      this.graphics_path_short.alpha = 0.8
      this.graphics_path_long.alpha = 0.7
      this.graphics_path_apply_area.alpha = 0.5
      this.graphics_lock_area.alpha = 0.4

      // 初始化事件管理器
      this.eventManager = new EventManager(this.app, this);
      this.eventManager.setupEventListeners();

      // 设置动画循环，更新所有车辆位置
      const tickerCallback = () => this.updateAgents()
      this.app.ticker.add(tickerCallback)
      this.addCleanupTask('tickerCallbacks', tickerCallback)

      if (this.mode == "test-demo") {
        // // 义东 demo 用
        // demo_get_traj(this.demo_update_path.bind(this), '/api/demo/get_traj');
        // setInterval(() => {
        //   demo_get_traj(this.demo_update_path.bind(this), '/api/demo/get_traj')
        // }, 1000)

        const ws = new WebSocketClient(`ws://${window.location.hostname}:${window.location.port}/api/ws/demo/demo_path`, {
          onMessage: (data) => { this.demo_update_path_ws(data) }
        }); ws.connect();

        this.long_path_width = 3
        this.short_path_width = 4

        const ws_pose = new WebSocketClient('ws://10.6.64.49:2030/api/ws/demo/pose_info', {
          onMessage: (data) => { this.pose_update(data) }
        });
        ws_pose.connect();

      } else {
        // 自己测试用
        const ws = new WebSocketClient('ws://10.6.64.49:2030/api/ws/demo/route_info', {
          onMessage: (data) => { this.path_update(data) }
        });
        ws.connect();

        const ws_pose = new WebSocketClient('ws://10.6.64.49:2030/api/ws/demo/pose_info', {
          onMessage: (data) => { this.pose_update(data) }
        });
        ws_pose.connect();

        this.long_path_width = 2
        this.short_path_width = 3
      }

    } catch (error) {
      console.error('初始化地图时出错:', error)
      // 可以在这里添加错误处理逻辑，比如显示错误提示等
    }
  }

  // 修改获取SVG内容的方法
  async fetchSvgContent() {
    // 尝试从缓存获取
    const cachedSvg = await mapCache.get('svg')
    if (cachedSvg) {
      console.log('使用缓存的SVG数据')
      this.svgContent = cachedSvg
      return cachedSvg
    }

    // 如果缓存中没有，从服务器获取
    console.log('从服务器获取SVG数据')
    try {
      const data = await get_svg_content('/api/map/svg', {})
      this.svgContent = data
      await mapCache.save('svg', data)
      return data
    } catch (error) {
      console.error('获取SVG内容失败:', error)
      throw error
    }
  }

  async initMap() {
    const tooltip = document.createElement('div')
    tooltip.style.cssText = `
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
    document.body.appendChild(tooltip)
    this.tooltip = tooltip

    const cons = new Container()
    const parser = new DOMParser()

    // 获取SVG内容
    if (!this.svgContent) {
      await this.fetchSvgContent()
    }

    const doc = parser.parseFromString(this.svgContent, 'image/svg+xml')
    console.log('doc: ', doc)
    const paths = Array.from(doc.querySelectorAll('path')).reverse()
    console.log('all path: ', paths.length)
    paths.forEach((path, index) => {
      const newSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

      path.setAttribute('style', 'fill:none;stroke:#888;stroke-width:1;') // 设置边框宽度

      // console.log("path", path);

      newSVG.appendChild(path)

      const serializer = new XMLSerializer()
      const svg = serializer.serializeToString(newSVG)
      let g = new Graphics()
      g.svg(svg)

      g.raw_path = path
      g.raw_svg = svg

      if (g.raw_path.hasAttribute('id')) {
        g.interactive = true
        g.cursor = 'pointer'
      } else {
        g.interactive = false
        g.cursor = 'default'
      }

      cons.addChild(g)
      g.on('pointerover', (e) => {
        console.log('pointerover', g.raw_path.getAttribute('id'));
        const path_u = g.raw_path.cloneNode(true);

        if (g.raw_path.hasAttribute('id')) {
          path_u.setAttribute('style', 'fill:none;stroke:#ff00ff;stroke-width:1.5');
        }

        const newSVG2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        newSVG2.appendChild(path_u);
        const serializer = new XMLSerializer();
        const svg2 = serializer.serializeToString(newSVG2);
        g.clear();
        g.svg(svg2);
        cons.setChildIndex(g, cons.children.length - 1);

        // 获取所有属性
        const attributes = Array.from(g.raw_path.attributes)
          .filter(attr => !['d', 'style'].includes(attr.name))  // 过滤掉d和style属性
          .map(attr => `${attr.name}: ${attr.value}`)
          .join('<br>');

        tooltip.innerHTML = attributes;
        tooltip.style.display = 'block';
        tooltip.style.left = e.clientX + 15 + 'px';
        tooltip.style.top = e.clientY + 10 + 'px';
      })
      g.on('pointerout', (e) => {
        g.clear()
        g.svg(g.raw_svg)
        tooltip.style.display = 'none'
      })
    })
    cons.alpha = 0.7
    return cons
  }

  drawAgent(data) {
    if (data.messageName == 'VehiclePositionInfo') {
      this.drawOneAgent(data)
    }
  }

  drawOneAgent(data) {
    const { vehicleId, x, y, theta } = data
    if (this.agents.hasOwnProperty(vehicleId)) {
      this.agents[vehicleId].setPosition(x, -y, theta)
    } else {
      this.add_agent(vehicleId, x, -y, theta)
    }
  }
  drawAllAgent(data) {
    let _data = data[v]
    const { vehicleId, x, y, theta } = _data
    if (this.agents.hasOwnProperty(vehicleId)) {
      this.agents[vehicleId].setPosition(x, -y, theta)
    } else {
      this.add_agent(vehicleId, x, -y, theta)
    }
  }

  graphics_sacle_move(e, graphic, scale_level_v) {
    let the_x = e.global.x - graphic.position.x
    let the_y = e.global.y - graphic.position.y

    // 缩放
    graphic.scale.set(graphic.scale.x * scale_level_v)

    // 缩放以左上角为原点，为了看起来是在指针处缩放的，我们把原先指针所指的点移回指针位置
    // 考虑某个点坐标 x, 缩放之后位置会偏移 (x * scale_level_v) 的距离
    // 因此需要调整的距离是 (x * scale_level_v) - x
    graphic.position.set(
      graphic.position.x - the_x * (scale_level_v - 1),
      graphic.position.y - the_y * (scale_level_v - 1),
    )
  }

  move_all_things(off_x, off_y) {
    this.mainContainer.position.set(
      this.mainContainer.position.x + off_x,
      this.mainContainer.position.y + off_y,
    )
    console.log('main container: ', this.mainContainer.position, this.mainContainer.scale.x)
  }

  // 更新所有车辆的位置
  updateAgents() {
    // 遍历所有车辆，调用更新方法
    for (const agent of Object.values(this.agents)) {
      agent.update();
    }
  }

  map_xy_to_app(point) {
    return [point[0], -point[1]]
  }


  get_lock_data_update(data) {
    // console.log("get lock area backend data:", data);
    const g = this.graphics_lock_area
    g.clear()
    for (const lock of data) {
      // console.log("get lock area backend data:", lock.polygon.points);
      let p0 = this.map_xy_to_app([
        lock.polygon.points[0].longitude,
        lock.polygon.points[0].latitude,
      ])
      g.moveTo(p0[0], p0[1])
      for (const point of lock.polygon.points) {
        let p = this.map_xy_to_app([point.longitude, point.latitude])
        g.lineTo(p[0], p[1])
      }
      // 连到起点，形成封闭区域
      // todo, 或许可以直接使用 g.poly
      g.lineTo(p0[0], p[1])
      let color = null
      if (lock.owner === 'PP') {
        color = '#cccc00'
      } else {
        color = '#ff0000'
      }
      g.stroke({ color: color, width: 1, pixelLine: false })
    }
  }

  demo_update_path(data) {
    // console.log('demo_update_path: ', data)
    for (const [vehicleId, v] of Object.entries(data.data)) {
      console.log('path: ', v)
      let path_t = []
      let start_index = v.start_pose.index
      if (v.start_pose["is_ahead"]) {
        start_index = start_index
      } else {
        start_index += 1
      }
      path_t.push([v.start_pose["x"], v.start_pose["y"]])
      let start_llt_id = v["path"][0]
      let path_start = this.map_path_info[start_llt_id]
      path_t.push(...path_start.slice(start_index))

      for (let i = start_index; i < v["path"].length - 1; i++) {
        let llt_id = v["path"][i]
        let one_path = this.map_path_info[llt_id]
        path_t.push(...one_path)
      }

      let end_index = v.end_pose.index

      if (v.end_pose["is_ahead"]) {
        end_index = end_index - 1
      } else {
        end_index = end_index
      }

      let end_llt_id = v["path"][v["path"].length - 1]
      let path_end = this.map_path_info[end_llt_id]
      path_t.push(...path_end.slice(0, end_index))

      path_t.push([v.end_pose["x"], v.end_pose["y"]])

      // console.log("get path rs", path_t)

      if (!this.agents.hasOwnProperty(vehicleId)) {
        this.add_agent(vehicleId, 9999, 9999, 0)
      }
      this.agents[vehicleId].graph_long_path.clear()
      this.drawPath(
        this.agents[vehicleId].graph_long_path,
        vehicleId,
        path_t,
        false,
        this.agents[vehicleId].color,
        this.long_path_width,
        1,
      )

    }
  }

  demo_update_path_ws(data) {
    console.log('demo_update_path_ws: ', data)
    this.demo_update_path(data)
  }

  demo_update_path_bak(data) {
    // 获取所有车辆ID并排序
    const vehicleIds = Object.keys(data.data).sort((a, b) => {
      // 如果ID是纯数字，则按数字大小排序
      if (!isNaN(a) && !isNaN(b)) {
        return Number(a) - Number(b);
      }
      // 否则按字符串排序
      return a.localeCompare(b);
    });
    console.log('sorted vehicle IDs:', vehicleIds);
    // 按排序后的顺序处理每个车辆
    for (const vehicleId of vehicleIds) {
      const value = data.data[vehicleId];
      let one_traj = value["point_path"]
      if (!this.agents.hasOwnProperty(vehicleId)) {
        this.add_agent(vehicleId, 9999, 9999, 0)
      }
      this.agents[vehicleId].graph_long_path.clear()
      this.drawPath(
        this.agents[vehicleId].graph_long_path,
        vehicleId,
        one_traj,
        false,
        this.agents[vehicleId].color,
        this.long_path_width,
        1,
      )
    }
  }

  path_update(data) {
    // console.log("get pp backend data:", data);
    if (data.type == "long_path") {
      let vehicleId = data.data.v
      this.agents[vehicleId].graph_long_path.clear()
      this.drawPath(
        this.agents[vehicleId].graph_long_path,
        vehicleId,
        data.data.path,
        false,
        this.agents[vehicleId].color,
        this.long_path_width,
        0.7,
      )
    } else if (data.type == "short_path") {
      let vehicleId = data.data.v
      this.agents[vehicleId].graph_short_path.clear()
      this.drawPath(
        this.agents[vehicleId].graph_short_path,
        vehicleId,
        data.data.path,
        false,
        this.agents[vehicleId].color,
        this.short_path_width,
        0.5,
      )
    }
  }

  pose_update(data) {
    console.log("get pose data2:", data.data);
    // data.data 是一个列表，刷新所有车zuobiao
    for (const [id, v] of Object.entries(data.data)) {
      // 如果禁用了平滑移动，则为每个Agent重置设置
      if (!this.smoothMovementConfig.enabled && this.agents[id]) {
        this.agents[id].isAnimating = false;
      }

      this.drawOneAgent({
        vehicleId: id,
        x: v.x,
        y: v.y,
        theta: v.yaw,
      })
    }
  }
}
