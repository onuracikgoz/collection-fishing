
export interface PaletteColor {
  hex: string
  count: number
}

// Her renk kanalını 32 seviyeli aralıklara ayırır.

export function getColorGroupKey(
  r: number,
  g: number,
  b: number,
  tolerance = 32,
): string {
  const step = Math.max(1, Math.min(64, tolerance))

  return [
    Math.floor(r / step),
    Math.floor(g / step),
    Math.floor(b / step),
  ].join('-')
}


export function hexToColorGroupKey(
  hex: string,
  tolerance = 32,
): string {
  const values = hex.match(/[0-9A-F]{2}/gi)

  if (!values || values.length !== 3) {
    return ''
  }

  return getColorGroupKey(
    parseInt(values[0], 16),
    parseInt(values[1], 16),
    parseInt(values[2], 16),
    tolerance,
  )
}

export function extractColorPalette(
  data: Uint8ClampedArray,
): PaletteColor[] {
  const groups = new Map<
    string,
    { r: number; g: number; b: number; count: number }
  >()

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]

    if (alpha === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = getColorGroupKey(r, g, b)

    const group = groups.get(key)

    if (group) {
      group.r += r
      group.g += g
      group.b += b
      group.count++
    } else {
      groups.set(key, {
        r,
        g,
        b,
        count: 1,
      })
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const r = Math.round(group.r / group.count)
      const g = Math.round(group.g / group.count)
      const b = Math.round(group.b / group.count)

      const hex =
        '#' +
        [r, g, b]
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()

      return {
        hex,
        count: group.count,
      }
    })
    .sort((a, b) => b.count - a.count)
}
