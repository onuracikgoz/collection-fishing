import { describe, expect, it } from 'vitest'
import { eraseAt, removeBackground } from '../src/engine/background'
import { extractColorPalette, getColorGroupKey } from '../src/engine/colorMapping'
import { prepareBase, DEFAULT_PREPARE } from '../src/engine/pipeline'
import { quantizeToPalette, parseHexPalette } from '../src/engine/quantize'
import { applyEdits } from '../src/engine/recolor'
import { fitToSquare } from '../src/engine/resize'
import { createVariant, generateRandomVariants, renderVariant, seededRandom } from '../src/engine/variant'
import { fromRows, px, solid } from './helpers'
import type { Rgb } from '../src/engine/pixels'

const W: Rgb = [255, 255, 255]
const K: Rgb = [20, 20, 20]
const R: Rgb = [200, 30, 30]
const B: Rgb = [30, 30, 200]

describe('recolor', () => {
  const img = fromRows(['.RB', 'RBK'], { R, B, K })

  it('applies every replacement from the source colors, independently', () => {
    const t = 32
    // Siyahı kırmızıya, kırmızıyı maviye çevir: kırmızıya dönen siyah tekrar mavi olmamalı.
    const out = applyEdits(img, {
      tolerance: t,
      replacements: { [getColorGroupKey(...K, t)]: '#C81E1E', [getColorGroupKey(...R, t)]: '#1E1EC8' },
      brightness: 100,
      saturation: 100,
    })
    expect(px(out, 2, 1)).toEqual([200, 30, 30, 255])
    expect(px(out, 1, 0)).toEqual([30, 30, 200, 255])
    expect(px(out, 0, 0)[3]).toBe(0)
    expect(px(img, 2, 1)).toEqual([20, 20, 20, 255])
  })

  it('brightness 100 / saturation 100 changes nothing, 0 saturation makes gray', () => {
    const same = applyEdits(img, { tolerance: 32, replacements: {}, brightness: 100, saturation: 100 })
    expect(Array.from(same.data)).toEqual(Array.from(img.data))
    const gray = applyEdits(img, { tolerance: 32, replacements: {}, brightness: 100, saturation: 0 })
    const [r, g, b] = px(gray, 1, 0)
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1)
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1)
  })

  it('palette respects tolerance', () => {
    const near = fromRows(['ab'], { a: [100, 100, 100], b: [104, 104, 104] })
    expect(extractColorPalette(near.data, 32)).toHaveLength(1)
    expect(extractColorPalette(near.data, 1)).toHaveLength(2)
  })
})

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
    const colors = extractColorPalette(buffer.data, 1).map((c) => c.hex)
    expect(colors.sort()).toEqual(['#1E1EC8', '#C81E1E'])
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

describe('variants', () => {
  // Koyu kontur, iki tonlu gövde.
  const L: Rgb = [220, 120, 120]
  const img = fromRows(
    ['.KKKKK.', 'KLLLLRK', 'KLRRRRK', 'KLRRRRK', 'KRRRRRK', '.KKKKK.'],
    { K, L, R },
  )

  it('tint keeps shading and the outline', () => {
    const spec = { ...createVariant('x', 'x', 'manual', '#3050C0') }
    const out = renderVariant(img, spec, 32, null)
    expect(px(out, 1, 0)).toEqual(px(img, 1, 0)) // kontur aynı
    const light = px(out, 1, 1)
    const dark = px(out, 3, 3)
    expect(light[2]).toBeGreaterThan(light[0]) // mavileşti
    expect(dark[2]).toBeGreaterThan(dark[0])
    const sum = (p: number[]) => p[0] + p[1] + p[2]
    expect(sum(light)).toBeGreaterThan(sum(dark)) // açık ton hâlâ açık
  })

  it('materials change the image and stay in the palette', () => {
    const palette: Rgb[] = [K, L, R, [250, 250, 250], [120, 20, 20], [249, 194, 43], [180, 120, 20]]
    for (const material of ['matte', 'glossy', 'metal', 'gold', 'silver', 'dark'] as const) {
      const out = renderVariant(img, { ...createVariant('x', 'x', 'manual'), material }, 32, palette)
      const allowed = new Set(palette.map((c) => c.join(',')))
      for (let i = 0; i < out.data.length; i += 4) {
        if (out.data[i + 3] === 0) continue
        expect(allowed.has(`${out.data[i]},${out.data[i + 1]},${out.data[i + 2]}`)).toBe(true)
      }
    }
  })

  it('random variants are unique, deterministic with a seed, and avoid used hues', () => {
    const palette = parseHexPalette('e83b3b\nfb6b1d\nf9c22b\n1ebc73\n4d9be6\na884f3\ned8099\n0eaf9b')
    const a = generateRandomVariants(5, 'shell', palette, [], seededRandom(7))
    const b = generateRandomVariants(5, 'shell', palette, [], seededRandom(7))
    expect(a.map((v) => v.id)).toEqual(b.map((v) => v.id))
    expect(new Set(a.map((v) => v.id)).size).toBe(5)
    expect(a.every((v) => v.origin === 'random' && v.status === 'pending')).toBe(true)
    const more = generateRandomVariants(3, 'shell', palette, a, seededRandom(8))
    expect(more.some((v) => a.some((x) => x.id === v.id))).toBe(false)
  })
})
