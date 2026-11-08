import { eraseAt, hardenAlpha, removeBackground, type Point } from './background'
import { addOutline } from './outline'
import { quantizeToPalette } from './quantize'
import { fitToSquare } from './resize'
import type { PixelBuffer, Rgb } from './pixels'

// AI görselini oyun ikonuna çeviren adımlar. Hepsi kaynak görselden
// yeniden hesaplanır, kaynak hiç değişmez.
export interface PrepareSettings {
  removeBackground: boolean
  // 0–255. Arka plan rengine bu kadar yakın kenar pikselleri silinir.
  backgroundTolerance: number
  // Sihirli silgi tıklamaları, kaynak görsel koordinatlarında.
  erasePoints: Point[]
  eraseTolerance: number
  resize: boolean
  size: number
  padding: number
  // Küçültmeden sonra 1 px koyu kontur çizer (kenar zaten koyuysa çizmez).
  outline: boolean
  quantize: boolean
  // Palete çekerken renk tonunu korur: lavanta nane yeşiline değil
  // beyaza / maviye gider.
  keepHue: boolean
}

// keepHue açıkken ton farkının ağırlığı (bkz. labDistance).
export const KEEP_HUE_WEIGHT = 2

export const DEFAULT_PREPARE: PrepareSettings = {
  removeBackground: true,
  backgroundTolerance: 24,
  erasePoints: [],
  eraseTolerance: 24,
  resize: true,
  size: 128,
  padding: 4,
  outline: true,
  quantize: true,
  keepHue: true,
}

// Default empty border around the object for an output size: 4 px on a
// 128 item, 1 px on a 16 icon, none on an 8 px inline icon.
export function paddingFor(size: number): number {
  return size >= 64 ? 4 : size >= 16 ? 1 : 0
}

export interface PreparedBase {
  buffer: PixelBuffer
  toSource(x: number, y: number): Point | null
}

export function prepareBase(
  source: PixelBuffer,
  settings: PrepareSettings,
  palette: Rgb[],
): PreparedBase {
  let buffer = hardenAlpha(source)

  if (settings.removeBackground) {
    buffer = removeBackground(buffer, settings.backgroundTolerance)
  }
  for (const point of settings.erasePoints) {
    buffer = eraseAt(buffer, point, settings.eraseTolerance)
  }

  let toSource = (x: number, y: number): Point | null =>
    x >= 0 && y >= 0 && x < source.width && y < source.height ? { x, y } : null

  if (settings.resize) {
    const fit = fitToSquare(buffer, settings.size, settings.padding)
    buffer = fit.buffer
    toSource = fit.toSource
  }

  if (settings.outline) {
    buffer = addOutline(buffer)
  }

  if (settings.quantize && palette.length > 0) {
    buffer = quantizeToPalette(buffer, palette, settings.keepHue ? KEEP_HUE_WEIGHT : 1)
  }

  return { buffer, toSource }
}
