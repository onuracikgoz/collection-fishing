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
  const base = path.split('/').pop() ?? path
  if (!/\.png$/i.test(base) || base.startsWith('.')) return null
  const id = base.replace(/\.png$/i, '').replace(/\s*\(\d+\)$/, '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return /^[a-z0-9][a-z0-9_.]{1,63}$/.test(id) ? id : null
}

export interface ZipImage {
  id: string
  path: string
  png: string
}

/** Every PNG in the ZIP (any folder), by item id. Names that are not ids come back in `bad`. */
export function readZip(bytes: Uint8Array): { images: ZipImage[]; bad: string[] } {
  const files = unzipSync(bytes, { filter: (f) => !f.name.startsWith('__MACOSX/') && /\.png$/i.test(f.name) })
  const images: ZipImage[] = []
  const bad: string[] = []
  const seen = new Set<string>()
  for (const path of Object.keys(files).sort()) {
    const id = idFromFileName(path)
    if (!id) {
      bad.push(path)
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    images.push({ id, path, png: bytesToBase64(files[path]) })
  }
  return { images, bad }
}
