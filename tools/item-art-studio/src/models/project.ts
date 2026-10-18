import { DEFAULT_TOLERANCE } from '../engine/colorMapping'
import { DEFAULT_PREPARE, type PrepareSettings } from '../engine/pipeline'
import type { PixelBuffer, Rgb } from '../engine/pixels'
import { createVariant, type VariantSpec } from '../engine/variant'
import type { CollectionSet } from './collectionSet'

// Yüklenen her PNG bir temel tasarımdır.
export interface BaseEntry {
  key: string
  // Set dosyasındaki base_id ile eşleşir (dosya adından türetilir).
  baseId: string
  fileName: string
  source: PixelBuffer
  prepare: PrepareSettings
  // Renk grubu toleransı. Grup anahtarları buna bağlı.
  tolerance: number
  variants: VariantSpec[]
}

export interface GamePalette {
  name: string
  colors: Rgb[]
}

export interface ProjectState {
  bases: BaseEntry[]
  set: CollectionSet | null
  palette: GamePalette
}

export function toSnakeId(text: string): string {
  return (
    text
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'item'
  )
}

let keyCounter = 0
export function newKey(): string {
  keyCounter++
  return `${Date.now().toString(36)}-${keyCounter}`
}

export function createBase(fileName: string, source: PixelBuffer): BaseEntry {
  const baseId = toSnakeId(fileName)
  return {
    key: newKey(),
    baseId,
    fileName,
    source,
    prepare: { ...DEFAULT_PREPARE, erasePoints: [] },
    tolerance: DEFAULT_TOLERANCE,
    variants: [],
  }
}

// Set dosyasında bu temel tasarıma ait eşyaları varyant olarak ekler.
// Var olan varyantlara dokunmaz. Set yoksa ve hiç varyant yoksa orijinal
// renkli tek bir varyant açar.
export function syncSetVariants(base: BaseEntry, set: CollectionSet | null): BaseEntry {
  const existing = new Set(base.variants.map((v) => v.id))
  const added: VariantSpec[] = []
  for (const item of set?.items ?? []) {
    if (item.base_id !== base.baseId || existing.has(item.id)) continue
    added.push(createVariant(item.id, item.name, 'set', item.variant_color))
  }
  if (added.length === 0 && base.variants.length === 0) {
    added.push(createVariant(base.baseId, base.baseId, 'manual'))
  }
  return added.length ? { ...base, variants: [...base.variants, ...added] } : base
}

export function setItemFor(set: CollectionSet | null, variantId: string) {
  return set?.items.find((item) => item.id === variantId) ?? null
}
