import { DEFAULT_PREPARE, type PrepareSettings } from '../engine/pipeline'
import type { PixelBuffer, Rgb } from '../engine/pixels'
import type { CollectionSet } from './collectionSet'

export type ImageStatus = 'pending' | 'approved' | 'rejected'

// Yüklenen her PNG, bir eşyanın aday görselidir. Aynı eşya için birden
// fazla aday olabilir; en fazla biri onaylanır.
export interface ImageEntry {
  key: string
  // Eşya id'si (set.json'daki `id`). Dosya adından türetilir.
  itemId: string
  fileName: string
  source: PixelBuffer
  prepare: PrepareSettings
  status: ImageStatus
}

export interface GamePalette {
  name: string
  colors: Rgb[]
}

export interface ProjectState {
  images: ImageEntry[]
  set: CollectionSet | null
  palette: GamePalette
}

export function toSnakeId(text: string): string {
  return (
    text
      .replace(/\.[a-z0-9]+$/i, '')
      // İndirilen kopyaların eki: "shell (2)".
      .replace(/\s*\(\d+\)$/, '')
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

export function createImage(fileName: string, source: PixelBuffer): ImageEntry {
  return {
    key: newKey(),
    itemId: toSnakeId(fileName),
    fileName,
    source,
    prepare: { ...DEFAULT_PREPARE, erasePoints: [] },
    status: 'pending',
  }
}

// Bir görseli onaylar; aynı eşyanın diğer onaylı adayını beklemeye alır.
export function approveImage(images: ImageEntry[], key: string): ImageEntry[] {
  const target = images.find((image) => image.key === key)
  if (!target) return images
  return images.map((image) => {
    if (image.key === key) return { ...image, status: 'approved' }
    if (image.itemId === target.itemId && image.status === 'approved') return { ...image, status: 'pending' }
    return image
  })
}

export interface ItemGroup {
  itemId: string
  name: string
  tier: string
  inSet: boolean
  images: ImageEntry[]
  approved: ImageEntry | null
}

// Görselleri eşyaya göre gruplar. Set yüklüyse setin bütün eşyaları (görseli
// olmayanlar dahil) set sırasıyla önce gelir, sette olmayan görseller sonra.
export function groupByItem(images: ImageEntry[], set: CollectionSet | null): ItemGroup[] {
  const byId = new Map<string, ImageEntry[]>()
  for (const image of images) {
    const list = byId.get(image.itemId)
    if (list) list.push(image)
    else byId.set(image.itemId, [image])
  }

  const groups: ItemGroup[] = []
  const make = (itemId: string, name: string, tier: string, inSet: boolean): ItemGroup => {
    const list = byId.get(itemId) ?? []
    return { itemId, name, tier, inSet, images: list, approved: list.find((i) => i.status === 'approved') ?? null }
  }
  for (const item of set?.items ?? []) {
    groups.push(make(item.id, item.name, item.tier, true))
    byId.delete(item.id)
  }
  for (const itemId of byId.keys()) groups.push(make(itemId, itemId, '', false))
  return groups
}
