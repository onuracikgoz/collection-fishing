import { useRef } from 'react'
import { prepareBase, type PreparedBase } from '../engine/pipeline'
import type { Rgb } from '../engine/pixels'
import type { ImageEntry } from '../models/project'

// Durum değişmez (immutable) güncellendiği için nesne kimliği yeterli bir
// önbellek anahtarıdır: yalnızca ayarı değişen görsel yeniden hesaplanır.
export function usePreparedCache() {
  const cache = useRef(new WeakMap<ImageEntry['prepare'], { source: unknown; palette: unknown; result: PreparedBase }>())

  return function getPrepared(image: ImageEntry, palette: Rgb[]): PreparedBase {
    const hit = cache.current.get(image.prepare)
    if (hit && hit.source === image.source && hit.palette === palette) return hit.result
    const result = prepareBase(image.source, image.prepare, palette)
    cache.current.set(image.prepare, { source: image.source, palette, result })
    return result
  }
}
