// Is an item image ready for the game? Same rules as Item Art Studio's output
// (docs/araclar/item-art-studio.md): 128x128, transparent background, only palette colours,
// hard edges, the object centred and filling the frame. Pure, works on raw RGBA.
export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array
}

export type Level = 'ok' | 'warn' | 'error'

export interface CheckLine {
  level: Level
  text: string
}

export interface ArtReport {
  level: Level
  lines: CheckLine[]
}

export const ITEM_SIZE = 128
const ICON_SIZES = [8, 16, 32]

export function parsePalette(text: string): Set<number> {
  const out = new Set<number>()
  for (const line of text.split(/\r?\n/)) {
    const m = /^#?([0-9a-f]{6})\b/i.exec(line.trim())
    if (m) out.add(parseInt(m[1], 16))
  }
  return out
}

const hex = (rgb: number) => '#' + rgb.toString(16).padStart(6, '0').toUpperCase()

export function checkArt(img: Pixels, palette: Set<number>): ArtReport {
  const lines: CheckLine[] = []
  const add = (level: Level, text: string) => lines.push({ level, text })
  const { width: w, height: h, data } = img

  if (w === ITEM_SIZE && h === ITEM_SIZE) add('ok', `Boyut ${w}×${h}`)
  else if (w === h && ICON_SIZES.includes(w)) add('warn', `Boyut ${w}×${h}: UI ikonu boyutu, defter eşyası 128×128 olmalı`)
  else add('error', `Boyut ${w}×${h}: eşya görseli 128×128 olmalı (Item Art Studio, Item 128)`)

  let opaque = 0
  let soft = 0
  let off = 0
  const offColors = new Map<number, number>()
  const colors = new Set<number>()
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = data[i + 3]
      if (a === 0) continue
      if (a < 255) soft++
      opaque++
      const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
      colors.add(rgb)
      if (palette.size > 0 && !palette.has(rgb)) {
        off++
        offColors.set(rgb, (offColors.get(rgb) ?? 0) + 1)
      }
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const total = w * h
  if (opaque === 0) {
    add('error', 'Görsel tamamen boş (her piksel şeffaf)')
    return { level: 'error', lines }
  }

  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => data[p * 4 + 3])
  if (opaque === total) add('error', 'Arka plan şeffaf değil (Item Art Studio arka planı siler)')
  else if (corners.some((a) => a !== 0)) add('warn', 'Köşelerde boyalı piksel var: arka plan tam silinmemiş olabilir')
  else add('ok', 'Arka plan şeffaf')

  if (soft > 0) add('warn', `${soft} yarı saydam piksel: kenarlar bulanık olabilir (pixel art'ta alfa 0 ya da 255 olur)`)

  if (palette.size === 0) add('warn', 'Palet yüklenemedi, renk kontrolü yapılmadı')
  else if (off === 0) add('ok', `Bütün renkler ortak palette (${colors.size} renk)`)
  else {
    const top = [...offColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => hex(c))
    const share = off / opaque
    add(share > 0.02 ? 'error' : 'warn', `${off} piksel palet dışı (${(share * 100).toFixed(1)}%), ör. ${top.join(', ')}: Item Art Studio'da palete çek`)
  }

  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const fill = Math.max(bw / w, bh / h)
  if (fill < 0.6) add('warn', `Nesne küçük: çerçevenin %${Math.round(fill * 100)}'ini kaplıyor (kırpılmamış olabilir)`)
  else add('ok', `Nesne çerçevenin %${Math.round(fill * 100)}'ini kaplıyor`)
  const dx = (minX + maxX + 1) / 2 - w / 2
  const dy = (minY + maxY + 1) / 2 - h / 2
  const shift = Math.max(Math.abs(dx), Math.abs(dy))
  if (shift > Math.max(2, w * 0.04)) add('warn', `Nesne ortada değil (${Math.round(dx)}, ${Math.round(dy)} px kaymış)`)
  else add('ok', 'Nesne ortalı')

  if (colors.size > 48) add('warn', `${colors.size} farklı renk: pixel art için çok, bulanık küçültülmüş olabilir`)

  const level: Level = lines.some((l) => l.level === 'error') ? 'error' : lines.some((l) => l.level === 'warn') ? 'warn' : 'ok'
  return { level, lines }
}
