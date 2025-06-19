import { Graphics, Text } from 'pixi.js'
import { stringToUniqueColor } from './graph.js'

const roundTo = (num, decimalPlaces) =>
  Math.round(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)

export default class Agent {
  constructor(manager, vehicle_id) {
    this.graphics = new Graphics()
    this.manager = manager
    this.w = 16
    this.h = 6
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
        fill: "#fff"
      },
    })
    this.color = stringToUniqueColor(vehicle_id)
    // this.color_head = '#2570e8'
    this.color_head = '#00d60b'

    this.graph_short_path = new Graphics()
    this.graph_short_path.eventMode = 'none'

    this.graph_long_path = new Graphics()
    this.graph_long_path.eventMode = 'none'
  }

  sync_text_pos(x, y) {
    return
    let scale = this.manager.mainContainer.scale.x;
    this.text.position.set(x, y)
    this.text.rotation = -this.manager.g_rotation
    // 动态调整字号，保持缩放时清晰
    const baseFontSize = 14;
    let newFontSize = baseFontSize
    // if (scale > 1){
    //   newFontSize *= scale
    // }else{
    //   newFontSize = baseFontSize / scale
    // }
    if (this.text.style.fontSize !== newFontSize) {
      this.text.style.fontSize = newFontSize;
    }
  }

  // 新方法：在每一帧更新位置
  update() {
    // 如果动画被禁用，直接返回
    if (!this.manager.smoothMovementConfig.enabled || !this.isAnimating) {
      return;
    }

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
    const newPosition = {
      x: roundTo(x, 4),
      y: roundTo(y, 4),
      theta: roundTo(theta, 4)
    };

    // 如果动画被禁用，直接设置位置并更新图形
    if (!this.manager.smoothMovementConfig.enabled) {
      this.position = newPosition;
      this.targetPosition = newPosition;
      this.isAnimating = false;
      this._updateGraphics();
      return;
    }

    // 动画启用时的原有逻辑
    this.targetPosition = newPosition;
    this.isAnimating = true;

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
