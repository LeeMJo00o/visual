import { Graphics, Text, Container } from 'pixi.js'
import { stringToUniqueColor } from './graph.ts'

const roundTo = (num, decimalPlaces) =>
  Math.round(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)

export default class Agent {
  constructor(manager, vehicle_id) {
    this.graphics = new Container()
    this.graphics_head = new Graphics()
    this.graphics_trailer = new Graphics()
    this.graphics.addChild(this.graphics_head)
    this.graphics.addChild(this.graphics_trailer)
    this.manager = manager

    // this.w = 16
    // this.h = 3.5

    this.head_front = 6.625
    this.head_back = 0.885

    this.trailer_front = 11
    this.trailer_back = 3.85
    this.width = 2.85

    this.vehicle_id = vehicle_id

    this.v_info = {
      block: '',
      blocked_by: '',
    }

    // 添加位置信息属性，用于tooltip显示
    this.position = {
      x: 0,
      y: 0,
      theta: 0,
      tx: 0,
      ty: 0,
      t_theta: 0,
    }

    // 添加目标位置和动画状态，用于平滑移动
    this.targetPosition = {
      x: 0,
      y: 0,
      theta: 0,
      tx: 0,
      ty: 0,
      t_theta: 0,
    }

    // 是否正在动画中
    this.isAnimating = false
    // 动画速度因子（较大的值 = 更快的移动）
    this.animationSpeed = 0.04
    // 用于检测位置是否足够接近目标的阈值
    this.positionThreshold = 0.01

    this.text = new Text({
      text: this.vehicle_id,
      style: {
        fontFamily: 'DejaVuSansMono',
        fontSize: 12,
        fill: '#fff',
      },
    })

    // 设置文本不响应鼠标事件，避免干扰车辆图形的交互
    this.text.eventMode = 'none'

    // 添加字体缩放相关的属性
    this.lastScale = 1.0
    this.scaleUpdateThreshold = 0.1 // 缩放变化超过0.1才更新字体

    this.color = stringToUniqueColor(vehicle_id)
    // this.color_head = '#2570e8'
    this.color_head = '#00d60b'

    this.graph_short_path = new Graphics()
    this.graph_short_path.eventMode = 'none'

    this.graph_long_path = new Graphics()
    this.graph_long_path.eventMode = 'none'
  }

  sync_text_pos(x, y) {
    // 将地图坐标转换为屏幕坐标
    // 坐标变换顺序：缩放 -> 旋转 -> 平移
    // 这与 raw_xy 方法的逆变换顺序一致
    const scale = this.manager.mainContainer.scale.x
    const rotation = this.manager.g_rotation
    const offsetX = this.manager.mainContainer.position.x
    const offsetY = this.manager.mainContainer.position.y

    // 1. 先缩放
    let screenX = x * scale
    let screenY = y * scale

    // 2. 再旋转
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const rotatedX = screenX * cos - screenY * sin
    const rotatedY = screenX * sin + screenY * cos

    // 3. 最后平移
    screenX = rotatedX + offsetX
    screenY = rotatedY + offsetY

    this.text.position.set(screenX, screenY)

    // 优化字体缩放：只在缩放变化超过阈值时才更新字体大小
    if (Math.abs(scale - this.lastScale) > this.scaleUpdateThreshold) {
      if (scale > 1) {
        this.text.style.fontSize = 12 + 12 * (scale - 1) * 0.1
      } else {
        this.text.style.fontSize = 12
      }
      this.lastScale = scale
    }

    // 文本旋转需要抵消地图旋转，保持水平显示
    // this.text.rotation = -rotation
  }

  // 新方法：在每一帧更新位置
  update() {
    // 如果动画被禁用，直接返回
    if (!this.manager.smoothMovementConfig.enabled || !this.isAnimating) {
      return
    }

    // 计算当前位置到目标位置的差距
    const dx = this.targetPosition.x - this.position.x
    const dy = this.targetPosition.y - this.position.y
    let dTheta = this.targetPosition.theta - this.position.theta
    let dTTheta = this.targetPosition.t_theta - this.position.t_theta

    // 处理角度变化可能超过180度的情况（确保旋转走最短路径）
    if (dTheta > Math.PI) dTheta -= 2 * Math.PI
    if (dTheta < -Math.PI) dTheta += 2 * Math.PI
    if (dTTheta > Math.PI) dTTheta -= 2 * Math.PI
    if (dTTheta < -Math.PI) dTTheta += 2 * Math.PI

    // 计算距离
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 检查是否太近或太远（超过15米）
    if (
      (distance < this.positionThreshold && Math.abs(dTheta) < this.positionThreshold) ||
      distance > 15
    ) {
      // 如果很接近或距离太远，直接设置到目标位置
      this.position = { ...this.targetPosition }
      this._updateGraphics()
      this.isAnimating = false
      return
    }

    this.position.x += dx * this.animationSpeed
    this.position.y += dy * this.animationSpeed
    this.position.theta += dTheta * this.animationSpeed

    // trailer 位置更新，与 x, y 保持一致
    this.position.tx += (this.targetPosition.tx - this.position.tx) * this.animationSpeed
    this.position.ty += (this.targetPosition.ty - this.position.ty) * this.animationSpeed
    this.position.t_theta += dTTheta * this.animationSpeed

    // 更新图形
    this._updateGraphics()
  }

  setPosition(x, y, theta, tx, ty, t_theta) {
    const newPosition = {
      x: roundTo(x, 4),
      y: roundTo(y, 4),
      theta: roundTo(theta, 4),
      tx: roundTo(tx, 4),
      ty: roundTo(ty, 4),
      t_theta: roundTo(t_theta, 4),
    }

    // 如果动画被禁用，直接设置位置并更新图形
    if (!this.manager.smoothMovementConfig.enabled) {
      this.position = newPosition
      this.targetPosition = newPosition
      this.isAnimating = false
      this._updateGraphics()
      return
    }

    // 动画启用时的原有逻辑
    this.targetPosition = newPosition
    this.isAnimating = true

    // 如果是首次设置位置，直接更新到目标位置（无需动画）
    if (this.position.x === 0 && this.position.y === 0 && this.position.theta === 0) {
      this.position = { ...this.targetPosition }
      this._updateGraphics()
      this.isAnimating = false
    }
  }

  // 新方法：更新图形显示
  _updateGraphics_simple() {
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

  // 新方法：更新图形显示
  _updateGraphicsHead(g) {
    g.clear()
    let _x = this.position.x
    let _y = this.position.y

    g.pivot.set(_x, _y)
    g.position.set(_x, _y)

    g.rect(-this.head_back, -this.width / 2, this.head_back + this.head_front, this.width)

    g.stroke({ color: this.color, width: 0.5 })
    g.rotation = -this.position.theta
    g.pivot.set(0, 0)
  }

  // 新方法：更新图形显示
  _updateGraphicsTrailer(g) {
    g.clear()
    let _x = this.position.tx
    let _y = this.position.ty
    g.pivot.set(_x, _y)
    g.position.set(_x, _y)

    g.rect(-this.trailer_back, -this.width / 2, this.trailer_back + this.trailer_front, this.width)
    g.stroke({ color: this.color, width: 0.5 })
    g.rotation = -this.position.t_theta
    g.pivot.set(0, 0)
  }

  _updateGraphics() {
    this._updateGraphicsHead(this.graphics_head)
    this._updateGraphicsTrailer(this.graphics_trailer)
    this.sync_text_pos(this.position.x, this.position.y)
  }
}
