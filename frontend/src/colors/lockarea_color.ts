const areaColorMapping = {
  lock: { fill: '#ff0000', border: '#ff0000' },
  limit: { fill: '#FDFD96', border: '#FFFF00' },
  no_parking: { fill: '#e645e3', border: '#e645e3' },
  trigger: { fill: '#7575f4ff', border: '#5353f7ff' },
  pga: { fill: '#00ff4457', border: '#00ff445c' },
  pla: { fill: '#8800ff4f', border: '#8800ff60' },
  ga: { fill: '#009dff6d', border: '#009dff64' },
  self_area: { fill: '#c8ff0067', border: '#c8ff006c' },
} as const

type AreaType = keyof typeof areaColorMapping

export function getFillColor(type: any) {
  return areaColorMapping[type as AreaType]?.fill ?? '#ff0000'
}

export function getBorderColor(type: any) {
  return areaColorMapping[type as AreaType]?.border ?? '#ff0000'
}
