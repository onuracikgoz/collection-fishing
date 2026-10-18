import { rgbToOklab as toOklab } from './color'
import { cloneBuffer, hexToRgb, rgbToHex, type PixelBuffer, type Rgb } from './pixels'

// Lospec `.hex` biçimi: her satırda bir renk (`RRGGBB` veya `#RRGGBB`).
// Boş satırlar ve `;` / `//` ile başlayan yorumlar atlanır.
export function parseHexPalette(text: string): Rgb[] {
  const colors: Rgb[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('//')) continue
    const rgb = hexToRgb(line)
    if (rgb) colors.push(rgb)
  }
  return colors
}

export function paletteToHex(palette: Rgb[]): string[] {
  return palette.map(([r, g, b]) => rgbToHex(r, g, b))
}

export interface PaletteMatcher {
  nearest(rgb: Rgb): Rgb
}

export function createPaletteMatcher(palette: Rgb[]): PaletteMatcher {
  const labs = palette.map(toOklab)
  const cache = new Map<number, Rgb>()

  return {
    nearest(rgb) {
      if (palette.length === 0) return rgb
      const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
      const cached = cache.get(key)
      if (cached) return cached

      const lab = toOklab(rgb)
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < labs.length; i++) {
        const dl = lab[0] - labs[i][0]
        const da = lab[1] - labs[i][1]
        const db = lab[2] - labs[i][2]
        const dist = dl * dl + da * da + db * db
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      cache.set(key, palette[best])
      return palette[best]
    },
  }
}

// Her opak pikseli paletteki en yakın renge çeker. Dithering yok:
// pixel-art'ta düz renk alanları istenir.
export function quantizeToPalette(source: PixelBuffer, palette: Rgb[]): PixelBuffer {
  const out = cloneBuffer(source)
  if (palette.length === 0) return out
  const matcher = createPaletteMatcher(palette)
  const data = out.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const [r, g, b] = matcher.nearest([data[i], data[i + 1], data[i + 2]])
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
  return out
}
