// TypeScript 中，从一个字符串生成颜色（整数），要求：
// 相同的字符串具有相同的颜色
// 相近的字符串颜色不要相近
// 颜色的整体亮度较高，假如亮度等级有1-100, 让亮度在30以上

import CryptoJS from 'crypto-js'
import { Graphics } from 'pixi.js'

// 定义点的接口
interface Point {
  x: number
  y: number
}

// 定义坐标数组类型
type PointArray = [number, number]

export function stringToUniqueColor(str: string): number {
  // 使用 MD5 哈希算法计算字符串的哈希值
  let hash: string = CryptoJS.MD5(str + 'salt_1').toString(CryptoJS.enc.Hex)

  // 从哈希值中提取 RGB 色值
  let r: number = parseInt(hash.substring(0, 2), 16) // 提取红色部分
  let g: number = parseInt(hash.substring(2, 4), 16) // 提取绿色部分
  let b: number = parseInt(hash.substring(4, 6), 16) // 提取蓝色部分

  // 确保亮度大于30
  const minBrightness: number = 50 // 最小亮度阈值
  const brightness: number = r * 0.299 + g * 0.587 + b * 0.114

  if (brightness < minBrightness) {
    // 计算需要提高的亮度比例
    const ratio: number = minBrightness / (brightness || 1) // 避免除以0

    // 按比例提高RGB值，保持色调不变
    r = Math.min(255, Math.round(r * ratio))
    g = Math.min(255, Math.round(g * ratio))
    b = Math.min(255, Math.round(b * ratio))
  }

  // 返回颜色的整数形式
  return (r << 16) | (g << 8) | b
}

export function rotatePoint(x: number, y: number, theta: number): Point {
  return {
    x: x * Math.cos(theta) - y * Math.sin(theta),
    y: x * Math.sin(theta) + y * Math.cos(theta),
  }
}

export function unrotatePoint(x_rotated: number, y_rotated: number, theta: number): Point {
  return {
    x: x_rotated * Math.cos(theta) + y_rotated * Math.sin(theta),
    y: -x_rotated * Math.sin(theta) + y_rotated * Math.cos(theta),
  }
}

export class GraphicTools {
  private graphics_path_apply_area!: Graphics

  // 坐标映射方法（需要在子类中实现）
  protected map_xy_to_app(point: PointArray): PointArray {
    // 这个方法应该在子类中被重写
    return point
  }

  drawLine(
    graphics: Graphics,
    id: string,
    points: PointArray[],
    dashed: boolean = false,
    color: number = 0xff0000,
    line_width: number = 1,
    alpha: number = 1,
  ): void {
    if (!points || points.length < 2) return

    // 对所有点进行坐标变换
    const transformedPoints: PointArray[] = points.map((point) => this.map_xy_to_app(point))

    if (dashed) {
      this.draw_points_dashed(transformedPoints, graphics, 7, 2)
      graphics.setStrokeStyle({ color: color, width: line_width, pixelLine: false })
      graphics.stroke()
    } else {
      let [x, y]: PointArray = transformedPoints[0]
      graphics.moveTo(x, y)
      for (let i = 1; i < transformedPoints.length; i++) {
        ;[x, y] = transformedPoints[i]
        graphics.lineTo(x, y)
      }
      graphics.stroke({ color: color, width: line_width, pixelLine: false, alpha: alpha })
    }
  }

  drawAppliedArea(areas: PointArray[][][]): void {
    if (areas.length < 1) {
      return
    }
    let [x, y]: PointArray = this.map_xy_to_app(areas[0][0][0])
    this.graphics_path_apply_area.moveTo(x, y)
    for (let i = 0; i < areas.length; i++) {
      for (let j = 0; j < areas[i][0].length; j++) {
        ;[x, y] = this.map_xy_to_app(areas[i][0][j])
        this.graphics_path_apply_area.lineTo(x, y)
        this.graphics_path_apply_area.setStrokeStyle({
          color: '#666666',
          width: 1,
          pixelLine: false,
        })
        this.graphics_path_apply_area.stroke()
      }
    }
  }

  draw_points_dashed(
    points: PointArray[],
    graphics: Graphics,
    dash: number = 5,
    gap: number = 3,
  ): void {
    for (let i = 0; i < points.length; i++) {
      const p: PointArray = points[i]
      if (i == 0) {
        graphics.moveTo(p[0], p[1])
      } else {
        const pre: PointArray = points[i - 1]
        this.drawDashedLine(graphics, pre[0], pre[1], p[0], p[1], dash, gap)
      }
    }
  }

  /**
   * Draw a dashed line
   * @param g - Graphics object
   * @param x1 - Start X coordinate
   * @param y1 - Start Y coordinate
   * @param x2 - End X coordinate
   * @param y2 - End Y coordinate
   * @param dash - The length of each dash
   * @param gap - The gap between each dash
   */
  drawDashedLine(
    g: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dash: number,
    gap: number,
  ): void {
    const dx: number = x2 - x1
    const dy: number = y2 - y1
    const distance: number = Math.sqrt(dx * dx + dy * dy)

    if (distance === 0) return

    const unitX: number = dx / distance
    const unitY: number = dy / distance

    let currentX: number = x1
    let currentY: number = y1
    let isDrawing: boolean = true
    let remainingDistance: number = distance

    while (remainingDistance > 0) {
      const step: number = isDrawing
        ? Math.min(dash, remainingDistance)
        : Math.min(gap, remainingDistance)

      const nextX: number = currentX + unitX * step
      const nextY: number = currentY + unitY * step

      if (isDrawing) {
        g.lineTo(nextX, nextY)
      } else {
        g.moveTo(nextX, nextY)
      }

      currentX = nextX
      currentY = nextY
      remainingDistance -= step
      isDrawing = !isDrawing
    }
  }
}
