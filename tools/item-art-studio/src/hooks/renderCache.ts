import { useRef } from 'react'
import { prepareBase, type PreparedBase } from '../engine/pipeline'
import type { Rgb } from '../engine/pixels'
import { renderVariant, type VariantSpec } from '../engine/variant'
import type { BaseEntry } from '../models/project'

// Durum değişmez (immutable) güncellendiği için nesne kimliği yeterli bir
// önbellek anahtarıdır: yalnızca değişen temel / varyant yeniden çizilir.
export function useRenderCache() {
  const prepared = useRef(new WeakMap<BaseEntry['prepare'], { source: unknown; palette: unknown; result: PreparedBase }>())
  const rendered = useRef(new WeakMap<VariantSpec, { base: unknown; tolerance: number; palette: unknown; result: ReturnType<typeof renderVariant> }>())

  function getPrepared(base: BaseEntry, palette: Rgb[]): PreparedBase {
    const hit = prepared.current.get(base.prepare)
    if (hit && hit.source === base.source && hit.palette === palette) return hit.result
    const result = prepareBase(base.source, base.prepare, palette)
    prepared.current.set(base.prepare, { source: base.source, palette, result })
    return result
  }

  function getRendered(base: BaseEntry, spec: VariantSpec, palette: Rgb[]) {
    const prep = getPrepared(base, palette)
    const quantize = base.prepare.quantize && palette.length > 0 ? palette : null
    const hit = rendered.current.get(spec)
    if (hit && hit.base === prep && hit.tolerance === base.tolerance && hit.palette === quantize) return hit.result
    const result = renderVariant(prep.buffer, spec, base.tolerance, quantize)
    rendered.current.set(spec, { base: prep, tolerance: base.tolerance, palette: quantize, result })
    return result
  }

  return { getPrepared, getRendered }
}
