// 输入点列表points以及点point， 进行投影后将列表切割为两个列表

export type Point = [number, number];
type Segment = [Point, Point];

export class PointProjection {
  private points: Point[];

  constructor(points: Point[]) {
    this.points = [...points];
  }

  private projectPointToSegment(point: Point, segment: Segment): { projection: Point | null, distance: number } {
    const [x, y] = point;
    const [[x1, y1], [x2, y2]] = segment;

    if (x1 === x2 && y1 === y2) {
      return {
        projection: [x1, y1],
        distance: Math.sqrt((x - x1) ** 2 + (y - y1) ** 2)
      };
    }

    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);

    return {
      projection: [projX, projY],
      distance: Math.sqrt((x - projX) ** 2 + (y - projY) ** 2)
    };
  }

  public findProjection(point: Point): { projection: Point, segmentIndex: number } | null {
    if (this.points.length < 2) return null;

    let minDistance = Infinity;
    let result: { projection: Point, segmentIndex: number } | null = null;

    for (let i = 0; i < this.points.length - 1; i++) {
      const segment: Segment = [this.points[i], this.points[i + 1]];
      const { projection, distance } = this.projectPointToSegment(point, segment);

      if (projection && distance < minDistance) {
        minDistance = distance;
        result = {
          projection,
          segmentIndex: i
        };
      }
    }

    return result;
  }

  /**
   * 将点列表根据投影点分割为两个部分
   * 返回格式: { firstPart: 投影点前的列表(包含投影点), secondPart: 投影点后的列表(包含投影点) }
   */
  public splitByProjection(projectionInfo: { projection: Point, segmentIndex: number }): {
    firstPart: Point[],
    secondPart: Point[]
  } {
    const { projection, segmentIndex } = projectionInfo;
    
    // 第一部分: 从开始到投影点所在线段的起点 + 投影点
    const firstPart = [
      ...this.points.slice(0, segmentIndex + 1),
      projection
    ];
    
    // 第二部分: 投影点 + 从投影点所在线段的终点到结束
    const secondPart = [
      projection,
      ...this.points.slice(segmentIndex + 1)
    ];
    
    return { firstPart, secondPart };
  }

  /**
   * 完整处理流程
   */
  public processPointProjection(point: Point): {
    originalPoints: Point[],
    projectionInfo: { projection: Point, segmentIndex: number } | null,
    splitParts: { firstPart: Point[], secondPart: Point[] } | null
  } {
    const projectionInfo = this.findProjection(point);
    if (!projectionInfo) {
      return {
        originalPoints: this.points,
        projectionInfo: null,
        splitParts: null
      };
    }

    return {
      originalPoints: this.points,
      projectionInfo,
      splitParts: this.splitByProjection(projectionInfo)
    };
  }

  /**
   * 输入两个点，向points投影，并获取投影之后两点之间的点集，包括前后的两个投影点
   * @param point1 - 第一个点
   * @param point2 - 第二个点
   * @returns 两点之间的点集，包括两个投影点
   */
  public getPointsBetweenProjections(point1: Point, point2: Point): Point[] {
    // 获取两个点的投影信息
    const projection1 = this.findProjection(point1);
    const projection2 = this.findProjection(point2);

    // 如果任一投影不存在，则返回null
    if (!projection1 || !projection2) {
      return [];
    }

    // 如果两个投影点在同一条线段上
    if (projection1.segmentIndex === projection2.segmentIndex) {
      // 直接返回两点之间的部分
      return [
        projection1.projection,
        projection2.projection
      ];
    }

    // 如果投影点1在线段索引较小
    if (projection1.segmentIndex < projection2.segmentIndex) {
      // 构造结果数组
      const result: Point[] = [];
      
      // 添加第一个投影点
      result.push(projection1.projection);
      
      // 添加第一个投影点所在段的终点到第二个投影点所在段的起点之间的所有点
      for (let i = projection1.segmentIndex + 1; i <= projection2.segmentIndex; i++) {
        result.push(this.points[i]);
      }
      
      // 添加第二个投影点（如果它不等于所在段的起点）
      if (projection2.projection[0] !== this.points[projection2.segmentIndex][0] || 
          projection2.projection[1] !== this.points[projection2.segmentIndex][1]) {
        result.push(projection2.projection);
      }
      
      return result;
    } else {
      // 如果投影点2在线段索引较小
      // 构造结果数组
      const result: Point[] = [];
      
      // 添加第二个投影点
      result.push(projection2.projection);
      
      // 添加第二个投影点所在段的终点到第一个投影点所在段的起点之间的所有点（逆序）
      for (let i = projection2.segmentIndex + 1; i <= projection1.segmentIndex; i++) {
        result.push(this.points[i]);
      }
      
      // 添加第一个投影点（如果它不等于所在段的起点）
      if (projection1.projection[0] !== this.points[projection1.segmentIndex][0] || 
          projection1.projection[1] !== this.points[projection1.segmentIndex][1]) {
        result.push(projection1.projection);
      }
      
      // 反转数组以确保点的顺序正确
      return result.reverse();
    }
  }

  // 
}