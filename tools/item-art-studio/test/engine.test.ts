import { describe, expect, it } from 'vitest'
import { eraseAt, removeBackground } from '../src/engine/background'
import { countColors } from '../src/engine/color'
import { prepareBase, DEFAULT_PREPARE } from '../src/engine/pipeline'
import { quantizeToPalette, parseHexPalette } from '../src/engine/quantize'
import { fitToSquare } from '../src/engine/resize'
import { fromRows, px, solid } from './helpers'
import type { Rgb } from '../src/engine/pixels'

const W: Rgb = [255, 255, 255]
const K: Rgb = [20, 20, 20]
const R: Rgb = [200, 30, 30]
const B: Rgb = [30, 30, 200]

describe('background', () => {
  it('removes the flat background but keeps same-colored pixels enclosed by the item', () => {
    const img = fromRows(['WWWWW', 'WKKKW', 'WKWKW', 'WKKKW', 'WWWWW'], { W, K })
    const out = removeBackground(img, 10)
    expect(px(out, 0, 0)[3]).toBe(0)
    expect(px(out, 1, 1)[3]).toBe(255)
    expect(px(out, 2, 2)[3]).toBe(255) // içerideki beyaz kalır
    const erased = eraseAt(out, { x: 2, y: 2 }, 10)
    expect(px(erased, 2, 2)[3]).toBe(0)
    expect(px(erased, 1, 1)[3]).toBe(255)
  })
})

describe('resize', () => {
  it('downscales by dominant color without blending and centers the item', () => {
    // 8x8 kaynak: 2x2 bloklar halinde kırmızı / mavi, tek bir gürültü pikseli.
    const img = fromRows(
      ['RRBBRRBB', 'RRBBRRBB', 'BBRRBBRR', 'BBRRBBRR', 'RRBBRRBB', 'RRBBRRBB', 'BBRRBBRR', 'BBRRBBRK'],
      { R, B, K },
    )
    const { buffer } = fitToSquare(img, 4, 0)
    expect(px(buffer, 0, 0)).toEqual([...R, 255])
    expect(px(buffer, 1, 0)).toEqual([...B, 255])
    expect(px(buffer, 3, 3)).toEqual([...R, 255])
    expect(countColors(buffer.data)).toBe(2)
  })

  it('does not upscale small items and centers them', () => {
    const img = solid(2, 2, R)
    const { buffer, toSource } = fitToSquare(img, 6, 0)
    expect(px(buffer, 2, 2)).toEqual([...R, 255])
    expect(px(buffer, 0, 0)[3]).toBe(0)
    expect(toSource(2, 2)).toEqual({ x: 0, y: 0 })
    expect(toSource(0, 0)).toBeNull()
  })
})

describe('palette', () => {
  const palette = parseHexPalette('; comment\nff0000\n#0000FF\n\nnot a color\n000000')

  it('parses .hex files', () => {
    expect(palette).toEqual([[255, 0, 0], [0, 0, 255], [0, 0, 0]])
  })

  it('snaps every opaque pixel to the palette', () => {
    const img = fromRows(['RBK.'], { R, B, K })
    const out = quantizeToPalette(img, palette)
    expect(px(out, 0, 0)).toEqual([255, 0, 0, 255])
    expect(px(out, 1, 0)).toEqual([0, 0, 255, 255])
    expect(px(out, 2, 0)).toEqual([0, 0, 0, 255])
    expect(px(out, 3, 0)[3]).toBe(0)
  })

  it('full prepare pipeline gives a 128px icon inside the palette', () => {
    const big = solid(512, 512, W)
    for (let y = 100; y < 400; y++) for (let x = 150; x < 350; x++) big.data.set([...R, 255], (y * 512 + x) * 4)
    const base = prepareBase(big, DEFAULT_PREPARE, palette)
    expect(base.buffer.width).toBe(128)
    expect(px(base.buffer, 0, 0)[3]).toBe(0)
    expect(px(base.buffer, 64, 64)).toEqual([255, 0, 0, 255])
  })
})

