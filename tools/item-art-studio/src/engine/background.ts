import { cloneBuffer, type PixelBuffer, type Rgb } from './pixels'

export interface Point {
  x: number
  y: number
}

function colorDistance(data: Uint8ClampedArray, i: number, ref: Rgb): number {
  return Math.max(
    Math.abs(data[i] - ref[0]),
    Math.abs(data[i + 1] - ref[1]),
    Math.abs(data[i + 2] - ref[2]),
  )
}

// Kenar piksellerinde en sık görülen opak renk. AI görsellerinin düz arka
// planı (genelde beyaz) budur. Kenarlar zaten şeffafsa null.
export function edgeBackgroundColor(buffer: PixelBuffer): Rgb | null {
  const { width, height, data } = buffer
  const counts = new Map<number, { rgb: Rgb; count: number }>()

  const visit = (x: number, y: number) => {
    const i = (y * width + x) * 4
    if (data[i + 3] === 0) return
    // 8'lik kutularla say ki JPEG benzeri gürültü tek renk sayılsın.
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { rgb: [data[i], data[i + 1], data[i + 2]], count: 1 })
  }

  for (let x = 0; x < width; x++) {
    visit(x, 0)
    visit(x, height - 1)
  }
  for (let y = 1; y < height - 1; y++) {
    visit(0, y)
    visit(width - 1, y)
  }

  let best: { rgb: Rgb; count: number } | null = null
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry
  }
  return best?.rgb ?? null
}

// Tohum noktalarından başlayıp `ref` rengine `tolerance` kadar yakın,
// birbirine bitişik pikselleri şeffaf yapar. Şeffaf pikseller geçilebilir.
function floodErase(
  buffer: PixelBuffer,
  seeds: Point[],
  ref: Rgb,
  tolerance: number,
): void {
  const { width, height, data } = buffer
  const visited = new Uint8Array(width * height)
  const stack: number[] = []

  for (const seed of seeds) {
    if (seed.x < 0 || seed.y < 0 || seed.x >= width || seed.y >= height) continue
    stack.push(seed.y * width + seed.x)
  }

  while (stack.length > 0) {
    const p = stack.pop()!
    if (visited[p]) continue
    visited[p] = 1

    const i = p * 4
    if (data[i + 3] !== 0 && colorDistance(data, i, ref) > tolerance) continue
    data[i + 3] = 0

    const x = p % width
    const y = (p - x) / width
    if (x > 0) stack.push(p - 1)
    if (x < width - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - width)
    if (y < height - 1) stack.push(p + width)
  }
}

// Kenarlara değen düz arka planı siler. Nesnenin içindeki aynı renkli
// alanlara dokunmaz (yalnızca kenardan ulaşılabilenler silinir).
export function removeBackground(buffer: PixelBuffer, tolerance: number): PixelBuffer {
  const out = cloneBuffer(buffer)
  const ref = edgeBackgroundColor(out)
  if (!ref) return out

  const { width, height } = out
  const seeds: Point[] = []
  for (let x = 0; x < width; x++) {
    seeds.push({ x, y: 0 }, { x, y: height - 1 })
  }
  for (let y = 1; y < height - 1; y++) {
    seeds.push({ x: 0, y }, { x: width - 1, y })
  }
  floodErase(out, seeds, ref, tolerance)
  defringe(out, ref, tolerance, 4)
  return out
}

// Piksel, `a` ile `b` renklerinin karışımı mı? (RGB'de iki renk arasındaki
// doğruya yakın ve uçlarda değil.)
function isBlendOf(data: Uint8ClampedArray, i: number, a: Rgb, b: Rgb, tolerance: number): boolean {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [data[i] - a[0], data[i + 1] - a[1], data[i + 2] - a[2]]
  const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]
  if (len2 < 1) return false
  const t = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2
  if (t <= 0.05 || t >= 0.95) return false
  const dx = ap[0] - t * ab[0]
  const dy = ap[1] - t * ab[1]
  const dz = ap[2] - t * ab[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= tolerance
}

// AI görsellerinde nesne kenarı arka planla karışır (hale). Şeffaflığa
// komşu bir piksel arka plana çok yakınsa ya da arka plan ile yanındaki
// nesne renginin karışımıysa silinir. Birkaç tur, çünkü hale birkaç piksel
// kalınlığında olabilir.
function defringe(buffer: PixelBuffer, ref: Rgb, tolerance: number, passes: number): void {
  const { width, height, data } = buffer
  const transparent = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height || data[(y * width + x) * 4 + 3] === 0
  for (let pass = 0; pass < passes; pass++) {
    const remove: number[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (data[i + 3] === 0) continue
        if (!transparent(x - 1, y) && !transparent(x + 1, y) && !transparent(x, y - 1) && !transparent(x, y + 1)) continue
        if (colorDistance(data, i, ref) <= tolerance * 2.5) {
          remove.push(i)
          continue
        }
        let blend = false
        for (let dy = -2; dy <= 2 && !blend; dy++) {
          for (let dx = -2; dx <= 2 && !blend; dx++) {
            if ((dx === 0 && dy === 0) || transparent(x + dx, y + dy)) continue
            const j = ((y + dy) * width + (x + dx)) * 4
            blend = isBlendOf(data, i, ref, [data[j], data[j + 1], data[j + 2]], Math.max(8, tolerance))
          }
        }
        if (blend) remove.push(i)
      }
    }
    if (remove.length === 0) return
    for (const i of remove) data[i + 3] = 0
  }
}

// Tıklanan noktadaki renge benzeyen bitişik alanı siler (sihirli silgi).
export function eraseAt(buffer: PixelBuffer, point: Point, tolerance: number): PixelBuffer {
  const out = cloneBuffer(buffer)
  const { width, height, data } = out
  if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return out
  const i = (point.y * width + point.x) * 4
  if (data[i + 3] === 0) return out
  floodErase(out, [point], [data[i], data[i + 1], data[i + 2]], tolerance)
  return out
}

// Yarı saydam pikselleri ya tam opak ya tam şeffaf yapar. Pixel-art'ta
// yumuşak kenar istenmez.
export function hardenAlpha(buffer: PixelBuffer, threshold = 128): PixelBuffer {
  const out = cloneBuffer(buffer)
  const data = out.data
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] >= threshold ? 255 : 0
  }
  return out
}
