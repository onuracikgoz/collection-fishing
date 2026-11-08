import { oklabToRgb, rgbToOklab } from './color'
import { cloneBuffer, type PixelBuffer, type Rgb } from './pixels'

// Bu açıklıktan (OKLab L) koyu kenar pikseli zaten kontur sayılır.
const ALREADY_DARK = 0.42

// Küçültme ince konturu yok eder (her blok baskın rengini alır). Bu adım
// nesnenin dışına 1 px kontur çizer: her şeffaf piksel, komşu nesne
// pikselinin koyu, hafif mora kaymış tonunu alır (LPC'deki gibi siyah değil).
// Kenarı zaten koyu olan yerlere dokunmaz, böylece AI'nın konturu
// korunduğunda çift kontur olmaz. Palete çekme bundan sonra yapılır.
export function addOutline(source: PixelBuffer): PixelBuffer {
  const out = cloneBuffer(source)
  const { width, height, data } = source
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] !== 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (opaque(x, y)) continue
      let darkest: Rgb | null = null
      let darkestL = Infinity
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!opaque(x + dx, y + dy)) continue
        const i = ((y + dy) * width + (x + dx)) * 4
        const rgb: Rgb = [data[i], data[i + 1], data[i + 2]]
        const L = rgbToOklab(rgb)[0]
        if (L < darkestL) {
          darkestL = L
          darkest = rgb
        }
      }
      if (!darkest || darkestL < ALREADY_DARK) continue
      const [r, g, b] = outlineColor(darkest)
      out.data.set([r, g, b, 255], (y * width + x) * 4)
    }
  }
  return out
}

// Nesne renginin koyu, biraz daha doygun ve mora kaymış hali.
export function outlineColor(rgb: Rgb): Rgb {
  const [L, a, b] = rgbToOklab(rgb)
  return oklabToRgb([L * 0.3, a * 0.9 + 0.012, b * 0.9 - 0.035])
}
