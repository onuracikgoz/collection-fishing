import { hexToRgb, rgbToHex } from './pixels'

export const DEFAULT_TOLERANCE = 32

export interface PaletteColor {
  // Renk grubunun anahtarı. Renk değişiklikleri bu anahtarla saklanır.
  key: string
  // Gruptaki piksellerin ortalama rengi.
  hex: string
  count: number
}

// RGB kanallarını `tolerance` genişliğinde kutulara böler. Aynı kutudaki
// renkler aynı gruptur. tolerance 1 ise her renk kendi grubudur.
export function getColorGroupKey(
  r: number,
  g: number,
  b: number,
  tolerance = DEFAULT_TOLERANCE,
): string {
  const step = Math.max(1, Math.min(64, Math.round(tolerance)))
  return `${Math.floor(r / step)}-${Math.floor(g / step)}-${Math.floor(b / step)}`
}

export function hexToColorGroupKey(hex: string, tolerance = DEFAULT_TOLERANCE): string {
  const rgb = hexToRgb(hex)
  return rgb ? getColorGroupKey(rgb[0], rgb[1], rgb[2], tolerance) : ''
}

// Opak piksellerin renk gruplarını, çoktan aza sıralı döndürür.
export function extractColorPalette(
  data: Uint8ClampedArray,
  tolerance = DEFAULT_TOLERANCE,
): PaletteColor[] {
  const groups = new Map<string, { r: number; g: number; b: number; count: number }>()

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = getColorGroupKey(r, g, b, tolerance)
    const group = groups.get(key)
    if (group) {
      group.r += r
      group.g += g
      group.b += b
      group.count++
    } else {
      groups.set(key, { r, g, b, count: 1 })
    }
  }

  return Array.from(groups, ([key, group]) => ({
    key,
    hex: rgbToHex(group.r / group.count, group.g / group.count, group.b / group.count),
    count: group.count,
  })).sort((a, b) => b.count - a.count)
}
