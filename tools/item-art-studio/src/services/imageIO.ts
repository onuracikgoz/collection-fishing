import type { PixelBuffer } from '../engine/pixels'

export function loadPngFile(file: File): Promise<PixelBuffer> {
  return new Promise((resolve, reject) => {
    if (file.type !== 'image/png') {
      reject(new Error('Lütfen PNG formatında bir görsel seç.'))
      return
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        reject(new Error('Canvas oluşturulamadı.'))
        return
      }
      context.drawImage(image, 0, 0)
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
      resolve({ width, height, data })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Görsel yüklenemedi. Başka bir PNG dosyası dene.'))
    }
    image.src = url
  })
}

export function drawBuffer(canvas: HTMLCanvasElement, buffer: PixelBuffer): void {
  if (canvas.width !== buffer.width) canvas.width = buffer.width
  if (canvas.height !== buffer.height) canvas.height = buffer.height
  const context = canvas.getContext('2d')
  if (!context) return
  context.putImageData(new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height), 0, 0)
}

export function bufferToPngBlob(buffer: PixelBuffer): Promise<Blob> {
  const canvas = document.createElement('canvas')
  drawBuffer(canvas, buffer)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG dışa aktarılamadı.'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function readTextFile(file: File): Promise<string> {
  return file.text()
}

// Dosya adını güvenli hale getirir ve `.png` uzantısını bir kez ekler.
export function safeFileName(name: string, extension = '.png'): string {
  const stem = name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  return `${stem || 'item'}${extension}`
}
