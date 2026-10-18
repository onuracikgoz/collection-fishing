// `content/sets/<set_id>/set.json` dosyasının bu aracın kullandığı kısmı.
// Şema collection-set-generator skill'inde tanımlı; araç bu dosyayı
// yalnızca okur, değiştirmez.
export interface SetItem {
  id: string
  name: string
  tier: string
  base_id: string
  variant_color: string | null
  image: string | null
  is_material?: boolean
}

export interface SetBaseDesign {
  base_id: string
  prompt_ref?: string
}

export interface CollectionSet {
  set_id: string
  name: string
  palette?: string[]
  base_designs: SetBaseDesign[]
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

  const items: SetItem[] = []
  raw.items.forEach((entry, index) => {
    if (!isObject(entry)) throw new Error(`items[${index}] bir nesne değil.`)
    const id = str(entry.id)
    const baseId = str(entry.base_id)
    if (!id) throw new Error(`items[${index}] içinde id yok.`)
    if (!baseId) throw new Error(`${id} için base_id yok.`)
    items.push({
      id,
      name: str(entry.name) ?? id,
      tier: str(entry.tier) ?? '',
      base_id: baseId,
      variant_color: str(entry.variant_color),
      image: str(entry.image),
      is_material: entry.is_material === true,
    })
  })

  const declared = Array.isArray(raw.base_designs)
    ? raw.base_designs.filter(isObject).flatMap((entry) => {
        const baseId = str(entry.base_id)
        return baseId ? [{ base_id: baseId, prompt_ref: str(entry.prompt_ref) ?? undefined }] : []
      })
    : []

  // base_designs listesinde olmayan ama eşyalarda geçen temel tasarımları da ekle.
  const known = new Set(declared.map((d) => d.base_id))
  for (const item of items) {
    if (!known.has(item.base_id)) {
      known.add(item.base_id)
      declared.push({ base_id: item.base_id, prompt_ref: undefined })
    }
  }

  return {
    set_id: setId,
    name: str(raw.name) ?? setId,
    palette: Array.isArray(raw.palette) ? raw.palette.filter((c): c is string => typeof c === 'string') : undefined,
    base_designs: declared,
    items,
  }
}

export function itemFileName(item: SetItem): string {
  const name = item.image ?? item.id
  return name.toLowerCase().endsWith('.png') ? name : `${name}.png`
}
