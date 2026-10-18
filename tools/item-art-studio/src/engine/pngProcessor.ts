import { extractColorPalette, type PaletteColor } from './colorMapping'

export interface PngAnalysis {
  width: number
  height: number
  totalPixels: number
  transparentPixels: number
  opaquePixels: number
  transparencyPercent: number
  hasTransparency: boolean
  hasPartialTransparency: boolean
  uniqueColors: number
  palette: PaletteColor[]
}

export function analyzeImage(image: HTMLImageElement): PngAnalysis {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!context) {
    throw new Error('Canvas context could not be created.')
  }

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  context.drawImage(image, 0, 0)

  const { data } = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  )

  let transparentPixels = 0
  let opaquePixels = 0
  let hasPartialTransparency = false

  const colors = new Set<string>()

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i]
    const green = data[i + 1]
    const blue = data[i + 2]
    const alpha = data[i + 3]

    if (alpha === 0) {
      transparentPixels++
      continue
    }

    opaquePixels++

    if (alpha < 255) {
      hasPartialTransparency = true
    }

    colors.add(`${red},${green},${blue},${alpha}`)
  }

  const totalPixels = canvas.width * canvas.height

  return {
    width: canvas.width,
    height: canvas.height,
    totalPixels,
    transparentPixels,
    opaquePixels,
    transparencyPercent:
      totalPixels === 0 ? 0 : (transparentPixels / totalPixels) * 100,
    hasTransparency: transparentPixels > 0,
    hasPartialTransparency,
    uniqueColors: colors.size,
    palette: extractColorPalette(data),
  }
}
