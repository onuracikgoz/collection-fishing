import { describe, expect, it } from 'vitest'
import { checkArt, parsePalette, type Pixels } from '../src/artCheck'

const PALETTE = parsePalette('2e222f\n3e3546\nffffff\n')

function img(size: number, paint: (x: number, y: number) => [number, number, number, number] | null): Pixels {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const c = paint(x, y)
      if (c) data.set(c, (y * size + x) * 4)
    }
  return { width: size, height: size, data }
}

const square = (lo: number, hi: number, color: [number, number, number, number] = [0x2e, 0x22, 0x2f, 255]) => (x: number, y: number) =>
  x >= lo && x < hi && y >= lo && y < hi ? color : null

describe('checkArt', () => {
  it('passes a clean 128 icon', () => {
    const r = checkArt(img(128, square(8, 120)), PALETTE)
    expect(r.level).toBe('ok')
  })

  it('catches size, background and palette problems', () => {
    expect(checkArt(img(100, square(5, 95)), PALETTE).level).toBe('error')
    expect(checkArt(img(16, square(1, 15)), PALETTE).level).toBe('warn')
    expect(checkArt(img(128, () => [255, 255, 255, 255]), PALETTE).lines.some((l) => /şeffaf değil/.test(l.text))).toBe(true)
    const off = checkArt(img(128, square(8, 120, [10, 200, 30, 255])), PALETTE)
    expect(off.level).toBe('error')
    expect(off.lines.some((l) => /palet dışı/.test(l.text))).toBe(true)
    expect(checkArt(img(128, () => null), PALETTE).level).toBe('error')
  })

  it('warns about small, off-centre objects and soft edges', () => {
    const small = checkArt(img(128, square(60, 70)), PALETTE)
    expect(small.lines.some((l) => /küçük/.test(l.text))).toBe(true)
    const shifted = checkArt(img(128, (x, y) => (x < 90 && y >= 10 && y < 118 ? [0x2e, 0x22, 0x2f, 255] : null)), PALETTE)
    expect(shifted.lines.some((l) => /ortada değil/.test(l.text))).toBe(true)
    const soft = checkArt(img(128, square(8, 120, [0x2e, 0x22, 0x2f, 128])), PALETTE)
    expect(soft.lines.some((l) => /yarı saydam/.test(l.text))).toBe(true)
  })
})
