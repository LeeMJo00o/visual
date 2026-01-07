type Coordinate = [number, number]
type GeometryType = 'POLYGON' | 'LINESTRING' | 'POINT' | 'MULTIPOLYGON'

interface WKTResult {
  type: GeometryType
  coordinates: Coordinate[]
}

/**
 * 完整的WKT解析器，支持多种几何类型
 */
export function parseWKT(wkt: string): WKTResult {
  // 提取几何类型
  const typeMatch = wkt.match(/^(\w+)\s+/)
  if (!typeMatch) {
    return { coordinates: [], type: 'POLYGON' }
    // throw new Error('无法识别WKT几何类型')
  }

  const geometryType = typeMatch[1] as GeometryType

  // 验证支持的几何类型
  const supportedTypes: GeometryType[] = ['POLYGON', 'LINESTRING', 'POINT', 'MULTIPOLYGON']
  if (!supportedTypes.includes(geometryType)) {
    throw new Error(`不支持的几何类型: ${geometryType}`)
  }

  // 提取坐标部分
  const innerContentMatch = wkt.match(/\(([^()]+)\)/)
  if (!innerContentMatch) {
    throw new Error('无效的WKT格式')
  }

  const coordsStr = innerContentMatch[1]
  const coordinates = extractCoordinatesFromString(coordsStr)

  return {
    type: geometryType,
    coordinates,
  }
}

/**
 * 从坐标字符串中提取坐标数组
 */
export function extractCoordinatesFromString(coordsStr: string): Coordinate[] {
  const points = coordsStr.split(/,\s*/)
  const coordinates: Coordinate[] = []

  for (const point of points) {
    const coords = point.trim().split(/\s+/)
    if (coords.length >= 2) {
      const x = parseFloat(coords[0])
      const y = parseFloat(coords[1])

      if (!isNaN(x) && !isNaN(y)) {
        coordinates.push([x, y])
      }
    }
  }

  return coordinates
}
