// Canvas'tan bağımsız piksel tamponu. Engine fonksiyonları bunun üzerinde
// çalışır, böylece tarayıcı olmadan test edilebilir.
export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type Rgb = [number, number, number]

export function createBuffer(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

export function cloneBuffer(buffer: PixelBuffer): PixelBuffer {
  return {
    width: buffer.width,
    height: buffer.height,
    data: new Uint8ClampedArray(buffer.data),
  }
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

export function pixelHex(buffer: PixelBuffer, x: number, y: number): string | null {
  const i = (y * buffer.width + x) * 4
  if (buffer.data[i + 3] === 0) return null
  return rgbToHex(buffer.data[i], buffer.data[i + 1], buffer.data[i + 2])
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

// Opak piksellerin sınır kutusu. Görsel tamamen şeffafsa null.
export function opaqueBounds(buffer: PixelBuffer): Bounds | null {
  const { width, height, data } = buffer
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
