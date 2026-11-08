import { labDistance, rgbToOklab, type Lab } from './color'
import { cloneBuffer, type PixelBuffer } from './pixels'

// 32 px ikonda AI görselinin ince ayrıntısı tek tük renk noktası olarak
// kalır ve ikon "parlak / karlı" görünür. El çizimi ikonlarda olduğu gibi
// birkaç düz ton ve tek piksellik gürültü olmadan sadeleştirir. Palete
// çekmeden sonra çalışır, yeni renk üretmez.

const key = (d: Uint8ClampedArray, i: number) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]

// En çok `max` renk bırakır: birbirine en yakın iki renkten azınlıkta olanı
// çoğunluktakine katar, sayı inene kadar tekrar eder.
export function limitColors(source: PixelBuffer, max: number): PixelBuffer {
  const out = cloneBuffer(source)
  const d = out.data
  const counts = new Map<number, number>()
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] !== 0) counts.set(key(d, i), (counts.get(key(d, i)) ?? 0) + 1)
  if (counts.size <= max) return out

  const lab = new Map<number, Lab>()
  for (const c of counts.keys()) lab.set(c, rgbToOklab([(c >> 16) & 255, (c >> 8) & 255, c & 255]))
  const target = new Map<number, number>()
  for (const c of counts.keys()) target.set(c, c)
  const alive = new Set(counts.keys())

  while (alive.size > max) {
    let best: [number, number] | null = null
    let bestD = Infinity
    const list = [...alive]
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const dist = labDistance(lab.get(list[a])!, lab.get(list[b])!)
        if (dist < bestD) {
          bestD = dist
          best = [list[a], list[b]]
        }
      }
    }
    const [p, q] = best!
    const [from, to] = counts.get(p)! < counts.get(q)! ? [p, q] : [q, p]
    alive.delete(from)
    counts.set(to, counts.get(to)! + counts.get(from)!)
    for (const [c, t] of target) if (t === from) target.set(c, to)
  }

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const t = target.get(key(d, i))!
    d[i] = (t >> 16) & 255
    d[i + 1] = (t >> 8) & 255
    d[i + 2] = t & 255
  }
  return out
}

// Tek piksellik gürültüyü siler: dört komşusundan hiçbiri kendi renginde
// değilse ve en az üçü aynı renkteyse o rengi alır. Konturun ve şeffaf
// kenarın şekline dokunmaz.
export function despeckle(source: PixelBuffer): PixelBuffer {
  const out = cloneBuffer(source)
  const { width, height, data } = source
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 0) continue
      const own = key(data, i)
      const votes = new Map<number, number>()
      let same = false
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const j = (ny * width + nx) * 4
        if (data[j + 3] === 0) continue
        const c = key(data, j)
        if (c === own) same = true
        votes.set(c, (votes.get(c) ?? 0) + 1)
      }
      if (same) continue
      for (const [c, n] of votes) {
        if (n < 3) continue
        out.data[i] = (c >> 16) & 255
        out.data[i + 1] = (c >> 8) & 255
        out.data[i + 2] = c & 255
      }
    }
  }
  return out
}
