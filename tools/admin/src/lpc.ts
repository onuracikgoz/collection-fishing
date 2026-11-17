// Draws a look the way the game does (client Wardrobe/LpcLook.cs, tools/wardrobe/preview_look.py):
// body, head, face, then the parts by z, each sheet recoloured through its tone map. The sheets are
// served by the dev server under /lpc/ (vite.config.ts).
import manifest from '../../../client/Assets/Resources/Wardrobe/lpc.json'

interface Sheet {
  walk: string
  idle?: string
  sit?: string
}
interface LpcPart {
  id: string
  layers: ({ z: number } & Record<'male' | 'female', Sheet>)[]
  maps: { src: string[]; tone: number[] }[]
}
interface Manifest {
  ramps: { id: string; tones: string[] }[]
  parts: LpcPart[]
}

const M = manifest as unknown as Manifest
const PARTS: Record<string, LpcPart> = Object.fromEntries(M.parts.map((p) => [p.id, p]))
const RAMPS: Record<string, string[]> = Object.fromEntries(M.ramps.map((r) => [r.id, r.tones]))
export const FRAME = 64
/** Walk sheet rows: up, left, down, right. */
export const DIR_ROW = { up: 0, left: 1, down: 2, right: 3 } as const

export interface Look {
  body: 'male' | 'female'
  skin: string
  eyes: string
  parts: { part: string; color: string; color2?: string }[]
}

export const hasSprite = (id: string) => id in PARTS

const images: Record<string, Promise<HTMLImageElement | null>> = {}
function image(path: string): Promise<HTMLImageElement | null> {
  if (!(path in images))
    images[path] = new Promise((done) => {
      const im = new Image()
      im.onload = () => done(im)
      im.onerror = () => done(null)
      im.src = '/lpc/' + path
    })
  return images[path]
}

const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const frames: Record<string, Promise<ImageData | null>> = {}
/** One 64x64 frame of one layer, recoloured. */
function layerFrame(path: string, maps: LpcPart['maps'], colors: string[], row: number): Promise<ImageData | null> {
  const key = `${path}|${colors.join(',')}|${row}`
  if (!(key in frames))
    frames[key] = image(path).then((im) => {
      if (!im) return null
      const c = document.createElement('canvas')
      c.width = c.height = FRAME
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.drawImage(im, 0, row * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME)
      const data = g.getImageData(0, 0, FRAME, FRAME)
      const lut = new Map<number, number[]>()
      maps.forEach((m, i) => {
        const ramp = RAMPS[colors[i] ?? '']
        if (!ramp) return
        m.src.forEach((src, j) => {
          const [r, gg, b] = rgb(src)
          lut.set((r << 16) | (gg << 8) | b, rgb(ramp[Math.min(Math.max(m.tone[j], 0), ramp.length - 1)]))
        })
      })
      if (lut.size) {
        const d = data.data
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue
          const to = lut.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
          if (to) [d[i], d[i + 1], d[i + 2]] = to
        }
      }
      return data
    })
  return frames[key]
}

/** Draws the look's standing frame facing `row` into a 64x64 canvas. */
export async function drawLook(canvas: HTMLCanvasElement, look: Look, row: number = DIR_ROW.down): Promise<void> {
  const layers: { z: number; order: number; path: string; maps: LpcPart['maps']; colors: string[] }[] = []
  const add = (id: string, ...colors: string[]) => {
    const p = PARTS[id]
    if (!p) return
    for (const L of p.layers) {
      const s = L[look.body]
      if (s?.walk) layers.push({ z: L.z, order: layers.length, path: s.walk, maps: p.maps, colors })
    }
  }
  add('body', look.skin)
  add('head_' + look.body, look.skin, look.eyes)
  add('face', look.skin, look.eyes)
  for (const p of look.parts) add(p.part, p.color, p.color2 ?? '')
  layers.sort((a, b) => a.z - b.z || a.order - b.order)
  const datas = await Promise.all(layers.map((l) => layerFrame(l.path, l.maps, l.colors, row)))
  const g = canvas.getContext('2d')!
  g.clearRect(0, 0, FRAME, FRAME)
  const tmp = document.createElement('canvas')
  tmp.width = tmp.height = FRAME
  const tg = tmp.getContext('2d')!
  for (const d of datas) {
    if (!d) continue
    tg.putImageData(d, 0, 0)
    g.drawImage(tmp, 0, 0)
  }
}
