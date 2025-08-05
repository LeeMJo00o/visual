const areaColorMapping = {
  lock: { fill: '#ff0000', border: '#ff0000' },
  limit: { fill: '#FDFD96', border: '#FFFF00' },
  no_parking: { fill: '#e645e3', border: '#e645e3' },
  trigger: { fill: '#7575f4ff', border: '#5353f7ff' }
} as const;

type AreaType = keyof typeof areaColorMapping;


export function getFillColor(type: any) {
  return areaColorMapping[type as AreaType]?.fill ?? '#ff0000';
}

export function getBorderColor(type: any) {
  return areaColorMapping[type as AreaType]?.border ?? '#ff0000';
}
