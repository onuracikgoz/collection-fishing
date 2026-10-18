// `content/sets/<set_id>/set.json` dosyasının bu aracın kullandığı kısmı.
// Şema collection-set-generator skill'inde tanımlı; araç bu dosyayı
// yalnızca okur, değiştirmez.
export interface SetItem {
  id: string
  name: string
  tier: string
  image: string | null
}

export interface CollectionSet {
  set_id: string
  name: string
  items: SetItem[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

// Bozuk veya eksik dosyada anlaşılır bir hata fırlatır.
export function parseCollectionSet(text: string): CollectionSet {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('set.json geçerli bir JSON değil.')
  }
  if (!isObject(raw)) throw new Error('set.json bir nesne olmalı.')

  const setId = str(raw.set_id)
  if (!setId) throw new Error('set.json içinde set_id yok.')
  if (!Array.isArray(raw.items)) throw new Error('set.json içinde items listesi yok.')

  const items: SetItem[] = raw.items.map((entry, index) => {
    if (!isObject(entry)) throw new Error(`items[${index}] bir nesne değil.`)
    const id = str(entry.id)
    if (!id) throw new Error(`items[${index}] içinde id yok.`)
    return { id, name: str(entry.name) ?? id, tier: str(entry.tier) ?? '', image: str(entry.image) }
  })

  return { set_id: setId, name: str(raw.name) ?? setId, items }
}

export function itemFileName(item: SetItem | null, itemId: string): string {
  const name = item?.image ?? itemId
  return name.toLowerCase().endsWith('.png') ? name : `${name}.png`
}
