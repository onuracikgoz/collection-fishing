import { eraseAt, hardenAlpha, removeBackground, type Point } from './background'
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
  quantize: boolean
}

export const DEFAULT_PREPARE: PrepareSettings = {
  removeBackground: true,
  backgroundTolerance: 24,
  erasePoints: [],
  eraseTolerance: 24,
  resize: true,
  size: 128,
  padding: 4,
  quantize: true,
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

  if (settings.quantize && palette.length > 0) {
    buffer = quantizeToPalette(buffer, palette)
  }

  return { buffer, toSource }
}
