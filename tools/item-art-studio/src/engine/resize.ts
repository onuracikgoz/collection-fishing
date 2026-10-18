import { createBuffer, opaqueBounds, type PixelBuffer } from './pixels'

export interface FitResult {
  buffer: PixelBuffer
  // Çıktıdaki bir pikselin kaynaktaki karşılığı. Nesne alanı dışındaysa null.
  toSource(x: number, y: number): { x: number; y: number } | null
}

// Nesneyi kare bir tuvale ortalar. Nesne `size - 2 * padding` alana
// sığmıyorsa küçültür. Küçültürken her hedef piksel, kaynaktaki bloğun en
// baskın rengini alır: ortalama almadığı için bulanıklaşmaz, yeni ara
// renkler üretmez. Büyütme yapmaz.
export function fitToSquare(source: PixelBuffer, size: number, padding = 0): FitResult {
  const out = createBuffer(size, size)
  const bounds = opaqueBounds(source)
  if (!bounds) return { buffer: out, toSource: () => null }

  const area = Math.max(1, size - 2 * padding)
  const scale = Math.min(1, area / Math.max(bounds.width, bounds.height))
  const targetW = Math.max(1, Math.round(bounds.width * scale))
  const targetH = Math.max(1, Math.round(bounds.height * scale))
  const offsetX = Math.floor((size - targetW) / 2)
  const offsetY = Math.floor((size - targetH) / 2)

  const src = source.data
  const dst = out.data
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>()

  for (let ty = 0; ty < targetH; ty++) {
    const y0 = bounds.y + Math.floor((ty * bounds.height) / targetH)
    const y1 = Math.max(y0 + 1, bounds.y + Math.floor(((ty + 1) * bounds.height) / targetH))

    for (let tx = 0; tx < targetW; tx++) {
      const x0 = bounds.x + Math.floor((tx * bounds.width) / targetW)
      const x1 = Math.max(x0 + 1, bounds.x + Math.floor(((tx + 1) * bounds.width) / targetW))

      buckets.clear()
      let total = 0
      let opaque = 0

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++
          const i = (y * source.width + x) * 4
          if (src[i + 3] < 128) continue
          opaque++
          // 16'lık kutular: AI gürültüsü tek renk sayılsın.
          const key = ((src[i] >> 4) << 8) | ((src[i + 1] >> 4) << 4) | (src[i + 2] >> 4)
          const bucket = buckets.get(key)
          if (bucket) {
            bucket.r += src[i]
            bucket.g += src[i + 1]
            bucket.b += src[i + 2]
            bucket.count++
          } else {
            buckets.set(key, { r: src[i], g: src[i + 1], b: src[i + 2], count: 1 })
          }
        }
      }

      // Bloğun yarısından azı doluysa şeffaf kalsın.
      if (opaque * 2 < total) continue

      let best: { r: number; g: number; b: number; count: number } | null = null
      for (const bucket of buckets.values()) {
        if (!best || bucket.count > best.count) best = bucket
      }
      if (!best) continue

      const o = ((offsetY + ty) * size + (offsetX + tx)) * 4
      dst[o] = Math.round(best.r / best.count)
      dst[o + 1] = Math.round(best.g / best.count)
      dst[o + 2] = Math.round(best.b / best.count)
      dst[o + 3] = 255
    }
  }

  return {
    buffer: out,
    toSource(x, y) {
      const tx = x - offsetX
      const ty = y - offsetY
      if (tx < 0 || ty < 0 || tx >= targetW || ty >= targetH) return null
      return {
        x: Math.min(bounds.x + bounds.width - 1, bounds.x + Math.floor(((tx + 0.5) * bounds.width) / targetW)),
        y: Math.min(bounds.y + bounds.height - 1, bounds.y + Math.floor(((ty + 0.5) * bounds.height) / targetH)),
      }
    },
  }
}
