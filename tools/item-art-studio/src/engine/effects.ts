import { lchToRgb, rgbToLch, type Lch } from './color'
import { getColorGroupKey } from './colorMapping'
import type { PixelBuffer, Rgb } from './pixels'

// Maske: piksel başına 1 (etkilenir) / 0. Maskeler her zaman temel
// (hazırlanmış) görselden hesaplanır.
export type Mask = Uint8Array

function lchAt(data: Uint8ClampedArray, i: number): Lch {
  return rgbToLch([data[i], data[i + 1], data[i + 2]])
}

function writeLch(data: Uint8ClampedArray, i: number, lch: Lch): void {
  const [r, g, b] = lchToRgb(lch)
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
}

function isOpaque(buffer: PixelBuffer, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return false
  return buffer.data[(y * buffer.width + x) * 4 + 3] !== 0
}

export function opaqueMask(buffer: PixelBuffer): Mask {
  const mask = new Uint8Array(buffer.width * buffer.height)
  for (let p = 0; p < mask.length; p++) mask[p] = buffer.data[p * 4 + 3] !== 0 ? 1 : 0
  return mask
}

// Şeffaflığa komşu ve koyu pikseller: AI ikonlarının dış konturu.
export function outlineMask(buffer: PixelBuffer, darkness = 0.4): Mask {
  const { width, height, data } = buffer
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isOpaque(buffer, x, y)) continue
      const edge =
        !isOpaque(buffer, x - 1, y) || !isOpaque(buffer, x + 1, y) ||
        !isOpaque(buffer, x, y - 1) || !isOpaque(buffer, x, y + 1)
      if (!edge) continue
      const i = (y * width + x) * 4
      if (lchAt(data, i).l < darkness) mask[y * width + x] = 1
    }
  }
  return mask
}

export function groupMask(buffer: PixelBuffer, keys: string[], tolerance: number): Mask {
  const wanted = new Set(keys)
  const { data } = buffer
  const mask = new Uint8Array(buffer.width * buffer.height)
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4
    if (data[i + 3] === 0) continue
    if (wanted.has(getColorGroupKey(data[i], data[i + 1], data[i + 2], tolerance))) mask[p] = 1
  }
  return mask
}

export function subtractMask(a: Mask, b: Mask): Mask {
  const out = new Uint8Array(a.length)
  for (let p = 0; p < a.length; p++) out[p] = a[p] && !b[p] ? 1 : 0
  return out
}

function meanLch(buffer: PixelBuffer, mask: Mask): Lch | null {
  let l = 0
  let c = 0
  let n = 0
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const lch = lchAt(buffer.data, p * 4)
    l += lch.l
    c += lch.c
    n++
  }
  return n === 0 ? null : { l: l / n, c: c / n, h: 0 }
}

// Maskedeki en sık renk. Boyamada bu renk hedef renge tam oturur, diğer
// tonlar ona göre açık / koyu kalır.
function dominantLch(buffer: PixelBuffer, mask: Mask): Lch | null {
  const counts = new Map<number, number>()
  let best = -1
  let bestCount = 0
  const { data } = buffer
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const i = p * 4
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    const count = (counts.get(key) ?? 0) + 1
    counts.set(key, count)
    if (count > bestCount) {
      bestCount = count
      best = key
    }
  }
  return best < 0 ? null : rgbToLch([(best >> 16) & 255, (best >> 8) & 255, best & 255])
}

// Gölgeyi koruyarak boyar: her pikselin parlaklık farkı korunur, renk tonu
// hedefe çekilir. Düz renk değiştirmenin aksine ışık-gölge kaybolmaz.
export function tint(buffer: PixelBuffer, mask: Mask, target: Rgb): void {
  const ref = dominantLch(buffer, mask)
  if (!ref) return
  const t = rgbToLch(target)
  const gray = t.c < 0.03
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const i = p * 4
    const lch = lchAt(buffer.data, i)
    const ratio = ref.c > 0.02 ? Math.min(1.6, Math.max(0.4, lch.c / ref.c)) : 1
    writeLch(buffer.data, i, {
      l: lch.l + (t.l - ref.l),
      c: gray ? t.c : t.c * ratio,
      h: t.h,
    })
  }
}

// Parlaklık farklarını ortalama etrafında açar / kapar, doygunluğu ölçekler.
export function contrast(buffer: PixelBuffer, mask: Mask, factor: number, chroma = 1, shift = 0): void {
  const ref = meanLch(buffer, mask)
  if (!ref) return
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const i = p * 4
    const lch = lchAt(buffer.data, i)
    writeLch(buffer.data, i, { l: ref.l + (lch.l - ref.l) * factor + shift, c: lch.c * chroma, h: lch.h })
  }
}

// Işık sol üstten gelir: üst / sol kenardaki pikselleri aydınlatır, alt /
// sağ kenardakileri karartır. Kenar = maske dışına komşu.
export function rimLight(buffer: PixelBuffer, mask: Mask, light: number, shadow = 0): void {
  const { width, height } = buffer
  const inMask = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1
  const changes: Array<[number, number]> = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inMask(x, y)) continue
      if (!inMask(x - 1, y) || !inMask(x, y - 1)) changes.push([y * width + x, light])
      else if (shadow && (!inMask(x + 1, y) || !inMask(x, y + 1))) changes.push([y * width + x, -shadow])
    }
  }
  for (const [p, delta] of changes) {
    const i = p * 4
    const lch = lchAt(buffer.data, i)
    writeLch(buffer.data, i, { ...lch, l: lch.l + delta })
  }
}

// Küçük bir parlama: maskenin sol üst çeyreğindeki en açık piksele 2×2 ışık.
export function sparkle(buffer: PixelBuffer, mask: Mask, amount: number): void {
  const { width, height } = buffer
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const x = p % width
    const y = (p - x) / width
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (maxX < 0) return
  const qx = minX + Math.floor((maxX - minX) * 0.45)
  const qy = minY + Math.floor((maxY - minY) * 0.45)
  let best = -1
  let bestL = -1
  for (let y = minY; y <= qy; y++) {
    for (let x = minX; x <= qx; x++) {
      const p = y * width + x
      if (!mask[p] || x + 1 >= width || y + 1 >= height) continue
      if (!mask[p + 1] || !mask[p + width] || !mask[p + width + 1]) continue
      const l = lchAt(buffer.data, p * 4).l
      if (l > bestL) {
        bestL = l
        best = p
      }
    }
  }
  if (best < 0) return
  for (const p of [best, best + 1, best + width]) {
    const i = p * 4
    const lch = lchAt(buffer.data, i)
    writeLch(buffer.data, i, { l: lch.l + amount, c: lch.c * 0.5, h: lch.h })
  }
}

export type PatternId = 'none' | 'stripes' | 'checker' | 'dots'

export function patternHit(pattern: PatternId, x: number, y: number): boolean {
  switch (pattern) {
    case 'stripes':
      return (x + y) % 6 < 2
    case 'checker':
      return (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0
    case 'dots':
      return x % 5 === 1 && y % 5 === 1
    default:
      return false
  }
}

// Desen piksellerini desen rengiyle, gölgeyi koruyarak boyar.
export function applyPattern(buffer: PixelBuffer, mask: Mask, pattern: PatternId, color: Rgb): void {
  if (pattern === 'none') return
  const sub = new Uint8Array(mask.length)
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const x = p % buffer.width
    if (patternHit(pattern, x, (p - x) / buffer.width)) sub[p] = 1
  }
  tint(buffer, sub, color)
}

export function fillMask(buffer: PixelBuffer, mask: Mask, color: Rgb): void {
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const i = p * 4
    buffer.data[i] = color[0]
    buffer.data[i + 1] = color[1]
    buffer.data[i + 2] = color[2]
  }
}
