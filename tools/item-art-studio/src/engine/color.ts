import type { Rgb } from './pixels'

// OKLab / OKLCh dönüşümleri. Algıya yakın parlaklık ve renk tonu için.
export type Lab = [number, number, number]
export interface Lch {
  l: number
  c: number
  h: number
}

function srgbToLinear(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(c * 255)))
}

export function rgbToOklab([r8, g8, b8]: Rgb): Lab {
  const r = srgbToLinear(r8)
  const g = srgbToLinear(g8)
  const b = srgbToLinear(b8)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function oklabToRgb([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

export function rgbToLch(rgb: Rgb): Lch {
  const [l, a, b] = rgbToOklab(rgb)
  const c = Math.sqrt(a * a + b * b)
  let h = (Math.atan2(b, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l, c, h }
}

export function lchToRgb({ l, c, h }: Lch): Rgb {
  const rad = (h * Math.PI) / 180
  return oklabToRgb([Math.max(0, Math.min(1, l)), c * Math.cos(rad), c * Math.sin(rad)])
}

export function luminance(rgb: Rgb): number {
  return rgbToOklab(rgb)[0]
}

// Dosya adlarında kullanılacak kaba renk adı.
export function colorName(rgb: Rgb): string {
  const { l, c, h } = rgbToLch(rgb)
  if (c < 0.04) {
    if (l > 0.85) return 'white'
    if (l < 0.3) return 'black'
    return 'gray'
  }
  if (h >= 20 && h < 75 && l < 0.55) return 'brown'
  if (h < 20 || h >= 350) return l > 0.75 ? 'pink' : 'red'
  if (h < 55) return 'orange'
  if (h < 75) return l > 0.7 ? 'gold' : 'orange'
  if (h < 110) return 'yellow'
  if (h < 135) return 'lime'
  if (h < 165) return 'green'
  if (h < 200) return 'teal'
  if (h < 230) return 'cyan'
  if (h < 275) return 'blue'
  if (h < 310) return 'purple'
  return 'pink'
}
