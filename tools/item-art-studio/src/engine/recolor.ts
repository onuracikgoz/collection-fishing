import { getColorGroupKey } from './colorMapping'
import { cloneBuffer, hexToRgb, type PixelBuffer, type Rgb } from './pixels'

export interface EditSettings {
  tolerance: number
  // Renk grubu anahtarı -> hedef HEX.
  replacements: Record<string, string>
  // Yüzde. 100 = değişiklik yok.
  brightness: number
  saturation: number
}

export const DEFAULT_EDITS: EditSettings = {
  tolerance: 32,
  replacements: {},
  brightness: 100,
  saturation: 100,
}

// Bütün renk değişikliklerini ve parlaklık / doygunluğu kaynak tampona
// uygular. Gruplar her zaman kaynak piksellerden hesaplanır, bu yüzden bir
// değişiklik diğerini etkilemez. Kaynak değişmez, yeni tampon döner.
export function applyEdits(source: PixelBuffer, edits: EditSettings): PixelBuffer {
  const out = cloneBuffer(source)
  const pixels = out.data

  const targets = new Map<string, Rgb>()
  for (const [key, hex] of Object.entries(edits.replacements)) {
    const rgb = hexToRgb(hex)
    if (rgb) targets.set(key, rgb)
  }

  const adjust = edits.brightness !== 100 || edits.saturation !== 100
  const b = edits.brightness / 100
  const s = edits.saturation / 100

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue

    let r = pixels[i]
    let g = pixels[i + 1]
    let bl = pixels[i + 2]

    if (targets.size > 0) {
      const target = targets.get(getColorGroupKey(r, g, bl, edits.tolerance))
      if (target) [r, g, bl] = target
    }

    if (adjust) {
      // CSS `brightness()` sonra `saturate()` ile aynı formül.
      r *= b
      g *= b
      bl *= b
      const nr = (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * bl
      const ng = (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * bl
      const nb = (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * bl
      r = nr
      g = ng
      bl = nb
    }

    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = bl
  }

  return out
}

// Yalnızca önizleme için: kaynakta `groupKey` grubunda olan pikselleri
// vurgu rengine boyar. Dışa aktarılan görsele yazılmaz.
export function highlightGroup(
  rendered: PixelBuffer,
  source: PixelBuffer,
  groupKey: string,
  tolerance: number,
  color: Rgb = [255, 40, 220],
): PixelBuffer {
  const out = cloneBuffer(rendered)
  const src = source.data
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] === 0) continue
    if (getColorGroupKey(src[i], src[i + 1], src[i + 2], tolerance) !== groupKey) continue
    out.data[i] = color[0]
    out.data[i + 1] = color[1]
    out.data[i + 2] = color[2]
  }
  return out
}
