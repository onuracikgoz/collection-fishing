// PNG bytes <-> pixels and base64, in the browser.
import { unzipSync } from 'fflate'
import type { Pixels } from './artCheck'

export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export const dataUrl = (base64: string) => `data:image/png;base64,${base64}`

export function decodePng(base64: string): Promise<Pixels> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return reject(new Error('Canvas açılamadı'))
      ctx.drawImage(image, 0, 0)
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve({ width: d.width, height: d.height, data: d.data })
    }
    image.onerror = () => reject(new Error('PNG okunamadı'))
    image.src = dataUrl(base64)
  })
}

/** "lost_captain/png/Sextant (1).png" → "sextant"; null if the name cannot be an item id. */
export function idFromFileName(path: string): string | null {
  const name = artName(path)
  return name && !name.icon ? name.id : null
}

/** Suffix of the 32x32 slot / ground icon next to an item image: `sextant@32.png`. */
export const ICON_SUFFIX = '@32'

/** File name → item id, and whether it is the item's 32x32 icon (`<id>@32.png`). */
export function artName(path: string): { id: string; icon: boolean } | null {
  const base = path.split('/').pop() ?? path
  if (!/\.png$/i.test(base) || base.startsWith('.')) return null
  let stem = base.replace(/\.png$/i, '').replace(/\s*\(\d+\)$/, '').trim()
  const icon = stem.toLowerCase().endsWith(ICON_SUFFIX)
  if (icon) stem = stem.slice(0, -ICON_SUFFIX.length)
  const id = stem.toLowerCase().replace(/[\s-]+/g, '_')
  return /^[a-z0-9][a-z0-9_.]{1,63}$/.test(id) ? { id, icon } : null
}

export interface ZipImage {
  id: string
  path: string
  png: string
  /** The 32x32 icon from `<id>@32.png`, if the ZIP has one. */
  icon?: string
  iconPath?: string
}

/**
 * Every item image in the ZIP (any folder), by item id, with its `@32` icon when there is one.
 * Names that are not ids, and icons without their item image, come back in `bad`.
 */
export function readZip(bytes: Uint8Array): { images: ZipImage[]; bad: string[] } {
  const files = unzipSync(bytes, { filter: (f) => !f.name.startsWith('__MACOSX/') && /\.png$/i.test(f.name) })
  const images: ZipImage[] = []
  const icons = new Map<string, string>()
  const bad: string[] = []
  const seen = new Set<string>()
  for (const path of Object.keys(files).sort()) {
    const name = artName(path)
    if (!name) {
      bad.push(path)
      continue
    }
    if (name.icon) {
      if (!icons.has(name.id)) icons.set(name.id, path)
      continue
    }
    if (seen.has(name.id)) continue
    seen.add(name.id)
    images.push({ id: name.id, path, png: bytesToBase64(files[path]) })
  }
  for (const img of images) {
    const iconPath = icons.get(img.id)
    if (iconPath) {
      img.icon = bytesToBase64(files[iconPath])
      img.iconPath = iconPath
      icons.delete(img.id)
    }
  }
  bad.push(...icons.values())
  return { images, bad }
}
