import { createBuffer, type PixelBuffer, type Rgb } from '../src/engine/pixels'

// Karakter haritasından test görseli: '.' şeffaf, diğer harfler `colors`'tan.
export function fromRows(rows: string[], colors: Record<string, Rgb>): PixelBuffer {
  const buffer = createBuffer(rows[0].length, rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.') continue
      const [r, g, b] = colors[ch]
      const i = (y * buffer.width + x) * 4
      buffer.data.set([r, g, b, 255], i)
    }
  })
  return buffer
}

export function px(buffer: PixelBuffer, x: number, y: number): [number, number, number, number] {
  const i = (y * buffer.width + x) * 4
  return [buffer.data[i], buffer.data[i + 1], buffer.data[i + 2], buffer.data[i + 3]]
}

export function solid(width: number, height: number, rgb: Rgb): PixelBuffer {
  const buffer = createBuffer(width, height)
  for (let i = 0; i < buffer.data.length; i += 4) buffer.data.set([...rgb, 255], i)
  return buffer
}
