import { useEffect, useRef, type MouseEvent } from 'react'
import type { PixelBuffer } from '../engine/pixels'
import { drawBuffer } from '../services/imageIO'

interface PixelCanvasProps {
  buffer: PixelBuffer
  className?: string
  // Ekranda gösterilecek boyut (px). Verilmezse CSS belirler.
  displaySize?: number
  label?: string
  onPixelClick?: (x: number, y: number) => void
}

// Tamponu doğal çözünürlüğünde çizer, ekranda en yakın komşu ile ölçekler.
export function PixelCanvas({ buffer, className, displaySize, label, onPixelClick }: PixelCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (ref.current) drawBuffer(ref.current, buffer)
  }, [buffer])

  function handleClick(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = ref.current
    if (!canvas || !onPixelClick) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return
    onPixelClick(x, y)
  }

  return (
    <canvas
      ref={ref}
      className={className}
      aria-label={label}
      onClick={onPixelClick ? handleClick : undefined}
      style={displaySize ? { width: displaySize, height: displaySize } : undefined}
    />
  )
}
