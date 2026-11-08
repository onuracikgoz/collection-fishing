import type { Rgb } from './pixels'

// OKLab: algıya yakın renk uzaklığı için (palete çekmede kullanılır).
export type Lab = [number, number, number]

function srgbToLinear(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
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

// Opak piksellerdeki farklı renk sayısı.
export function countColors(data: Uint8ClampedArray): number {
  const colors = new Set<number>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
  }
  return colors.size
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(v * 255)))
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

// OKLab uzaklığı; `hueWeight` > 1 ise renk tonu farkı daha ağır sayılır.
// Böylece paletteki en yakın renk açıklıkça yakın ama başka tonda olan
// (lavanta → nane yeşili gibi) bir renk yerine aynı tona yakın olan seçilir.
export function labDistance(p: Lab, q: Lab, hueWeight = 1): number {
  const dL = p[0] - q[0]
  const da = p[1] - q[1]
  const db = p[2] - q[2]
  const dab2 = da * da + db * db
  if (hueWeight === 1) return dL * dL + dab2
  const dC = Math.hypot(p[1], p[2]) - Math.hypot(q[1], q[2])
  const dH2 = Math.max(0, dab2 - dC * dC)
  return dL * dL + dC * dC + hueWeight * hueWeight * dH2
}
