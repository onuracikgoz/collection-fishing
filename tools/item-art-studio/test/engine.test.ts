import { describe, expect, it } from 'vitest'
import { eraseAt, removeBackground } from '../src/engine/background'
import { countColors, oklabToRgb, rgbToOklab } from '../src/engine/color'
import { addOutline } from '../src/engine/outline'
import { prepareBase, prepareForGame, DEFAULT_PREPARE, GAME_ICON_SIZE, GAME_ITEM_SIZE, KEEP_HUE_WEIGHT, paddingFor } from '../src/engine/pipeline'
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


describe('icon sizes', () => {
  it('uses less padding for small UI icons', () => {
    expect(paddingFor(128)).toBe(4)
    expect(paddingFor(16)).toBe(1)
    expect(paddingFor(8)).toBe(0)
  })

  it('shrinks a large image to a 16 px icon with a 1 px border', () => {
    const img = solid(160, 160, R)
    const { buffer } = prepareBase(img, { ...DEFAULT_PREPARE, removeBackground: false, quantize: false, size: 16, padding: paddingFor(16) }, [])
    expect(buffer.width).toBe(16)
    expect(px(buffer, 0, 0)[3]).toBe(0)
    expect(px(buffer, 1, 1)[3]).toBe(255)
    expect(px(buffer, 14, 14)[3]).toBe(255)
    expect(px(buffer, 15, 15)[3]).toBe(0)
  })
})

describe('outline', () => {
  const Lav: Rgb = [227, 226, 242]
  const D: Rgb = [40, 30, 50]

  it('draws a dark 1 px outline around a light item', () => {
    const img = fromRows(['.....', '.LLL.', '.LLL.', '.....'], { L: Lav })
    const out = addOutline(img)
    expect(px(out, 0, 0)[3]).toBe(0) // corners stay empty (4-neighbour only)
    const edge = px(out, 0, 1)
    expect(edge[3]).toBe(255)
    expect(edge[0] + edge[1] + edge[2]).toBeLessThan(200)
    expect(px(out, 2, 1)).toEqual([...Lav, 255]) // item untouched
  })

  it('skips edges that are already dark, so there is no double outline', () => {
    const img = fromRows(['....', '.DD.', '....'], { D })
    const out = addOutline(img)
    expect(px(out, 0, 1)[3]).toBe(0)
  })

  it('prepare pipeline adds the outline before the palette step', () => {
    const big = solid(256, 256, W)
    for (let y = 60; y < 200; y++) for (let x = 60; x < 200; x++) big.data.set([...Lav, 255], (y * 256 + x) * 4)
    const palette = parseHexPalette('ffffff\nc7dcd0\n2e222f')
    const settings = { ...DEFAULT_PREPARE, size: 32, padding: paddingFor(32) }
    const { buffer } = prepareBase(big, settings, palette)
    // 1 px padding: the item fills x 1..30, the outline lands on x 0.
    expect(px(buffer, 0, 16)).toEqual([0x2e, 0x22, 0x2f, 255])
    expect(px(buffer, 16, 16)).toEqual([255, 255, 255, 255])
    const off = prepareBase(big, { ...settings, outline: false }, palette).buffer
    expect(px(off, 0, 16)[3]).toBe(0)
  })
})

describe('keep hue', () => {
  // Resurrect 64'ten: beyaz, nane-gri, açık mavi.
  const palette = parseHexPalette('ffffff\nc7dcd0\n8fd3ff')

  it('plain OKLab sends light lavender to the mint gray', () => {
    const out = quantizeToPalette(fromRows(['L'], { L: [227, 226, 242] }), palette, 1)
    expect(px(out, 0, 0)).toEqual([0xc7, 0xdc, 0xd0, 255])
  })

  it('with hue weight light lavender goes to white instead', () => {
    const out = quantizeToPalette(fromRows(['L'], { L: [227, 226, 242] }), palette, KEEP_HUE_WEIGHT)
    expect(px(out, 0, 0)).toEqual([255, 255, 255, 255])
  })

  it('oklab round-trips', () => {
    for (const rgb of [[0, 0, 0], [255, 255, 255], [200, 100, 50], [12, 200, 240]] as Rgb[]) {
      expect(oklabToRgb(rgbToOklab(rgb))).toEqual(rgb)
    }
  })
})

describe('game export', () => {
  it('makes a 128 item image and a 32 icon from the same settings', () => {
    const big = solid(256, 256, W)
    for (let y = 60; y < 200; y++) for (let x = 60; x < 200; x++) big.data.set([...R, 255], (y * 256 + x) * 4)
    const palette = parseHexPalette('ff0000\n000000')
    // The preview size picked in the UI does not matter.
    const { item, icon } = prepareForGame(big, { ...DEFAULT_PREPARE, size: 16, padding: 1 }, palette)
    expect([item.width, icon.width]).toEqual([GAME_ITEM_SIZE, GAME_ICON_SIZE])
    expect(px(icon, 16, 16)).toEqual([255, 0, 0, 255])
    expect(px(icon, 0, 16)).toEqual([0, 0, 0, 255]) // outline on the 1 px border
  })
})
