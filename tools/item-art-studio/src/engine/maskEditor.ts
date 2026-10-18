
export interface ColorRegion {
  id: string
  name: string
  color: string
  pixelCount: number
  selected: boolean
}

export interface RegionMask {
  width: number
  height: number
  regions: ColorRegion[]
  pixelRegionIds: Int32Array
}

export function createRegionMask(
  imageData: ImageData,
): RegionMask {
  const { width, height, data } = imageData

  const colorMap = new Map<string, number>()
  const pixelRegionIds = new Int32Array(width * height)

  const regions: ColorRegion[] = []

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    const alpha = data[i + 3]

    // Şeffaf pikseller herhangi bir bölgeye dahil edilmez.
    if (alpha === 0) {
      pixelRegionIds[pixelIndex] = -1
      continue
    }

    const color =
      '#' +
      [data[i], data[i + 1], data[i + 2]]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()

    let regionIndex = colorMap.get(color)

    if (regionIndex === undefined) {
      regionIndex = regions.length
      colorMap.set(color, regionIndex)

      regions.push({
        id: `region-${regionIndex}`,
        name: `Region ${regionIndex + 1}`,
        color,
        pixelCount: 0,
        selected: false,
      })
    }

    pixelRegionIds[pixelIndex] = regionIndex
    regions[regionIndex].pixelCount++
  }

  return {
    width,
    height,
    regions,
    pixelRegionIds,
  }
}
