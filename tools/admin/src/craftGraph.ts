// Craft trees for the Items tab: what an item is made of (down) and what a material goes into (up),
// for collection items (content items' recipes) and wardrobe parts (wardrobe recipes). Pure, testable.
import type { ContentDoc, ContentItem } from './content'
import type { WardrobeCatalog, WardrobeMaterial, WardrobePart, WardrobeRecipe } from '../../../server/src/rules/wardrobe'

/** What a tree node points at. Clicking an item / part / material opens it. */
export type Ref = { kind: 'item'; id: string } | { kind: 'part'; id: string; fx?: string } | { kind: 'wmat'; id: string } | { kind: 'pattern' } | { kind: 'color'; area: 1 | 2; fx?: string }

export interface TreeNode {
  key: string
  ref: Ref
  label: string
  tier: string | null
  /** How many go in (down tree) or how many it takes (up tree). */
  count?: number
  sub?: string
  children: TreeNode[]
  /** Already shown higher up this branch, not expanded again. */
  loop?: boolean
  /** Position in the root recipe's mats list (editable wardrobe nodes). */
  index?: number
}

const MAX_DEPTH = 6

export const refKey = (r: Ref) => (r.kind === 'item' || r.kind === 'wmat' ? `${r.kind}:${r.id}` : r.kind === 'part' ? `part:${r.id}${r.fx ? ':' + r.fx : ''}` : r.kind)

const itemMap = (doc: ContentDoc) => Object.fromEntries(doc.items.map((it) => [it.id, it])) as Record<string, ContentItem>

/** A collection item and its recipe inputs; inputs that are craftable themselves open further down. */
export function itemTree(doc: ContentDoc, id: string): TreeNode {
  const items = itemMap(doc)
  const walk = (id: string, count: number | undefined, path: string[], key: string): TreeNode => {
    const it = items[id]
    const node: TreeNode = { key, ref: { kind: 'item', id }, label: it?.name ?? id, tier: it?.tier ?? null, count, sub: it ? undefined : 'bilinmeyen id', children: [] }
    if (!it?.recipe) return node
    if (path.includes(id) || path.length >= MAX_DEPTH) return { ...node, loop: true }
    const inputs = [...it.recipe.stacks, ...it.recipe.items]
    node.children = inputs.map((s, i) => walk(s.defId, s.count, [...path, id], `${key}/${i}`))
    return node
  }
  return walk(id, undefined, [], 'r')
}

/** Every collection item whose recipe takes this id, and what those go into, upwards. */
export function itemUsedInTree(doc: ContentDoc, id: string): TreeNode {
  const items = itemMap(doc)
  const users = (id: string) =>
    doc.items.flatMap((it) => {
      const s = it.recipe ? [...it.recipe.stacks, ...it.recipe.items].find((x) => x.defId === id) : undefined
      return s ? [{ it, count: s.count }] : []
    })
  const walk = (id: string, count: number | undefined, path: string[], key: string): TreeNode => {
    const it = items[id]
    const node: TreeNode = { key, ref: { kind: 'item', id }, label: it?.name ?? id, tier: it?.tier ?? null, count, children: [] }
    if (path.includes(id) || path.length >= MAX_DEPTH) return { ...node, loop: true }
    node.children = users(id).map((u, i) => walk(u.it.id, u.count, [...path, id], `${key}/${i}`))
    return node
  }
  return walk(id, undefined, [], 'u')
}

const COLOR_KIND_LABEL: Record<string, string> = { dye: 'Boya', hair: 'Saç boyası', metal: 'Külçe', gem: 'Mücevher' }
export const colorKindsLabel = (kinds: string[] | undefined) => (kinds && kinds.length ? kinds.map((k) => COLOR_KIND_LABEL[k] ?? k).join(' / ') : 'sabit renk')

/** A wardrobe part's recipe: its own pattern, the materials, one colour per colour area. fx = the Mythic recipe for that effect. */
export function partTree(cat: WardrobeCatalog, partId: string, fx?: string): TreeNode {
  const p = cat.parts.find((x) => x.id === partId)
  const mats = Object.fromEntries((cat.materials ?? []).map((m) => [m.id, m])) as Record<string, WardrobeMaterial>
  const tier = fx ? 'mythic' : (p?.tier ?? null)
  const root: TreeNode = { key: 'r', ref: { kind: 'part', id: partId, fx }, label: (fx ? effectName(fx) + ' ' : '') + (p?.name ?? partId), tier, children: [] }
  if (!p) return { ...root, sub: 'bilinmeyen parça' }
  const recipe = fx ? p.mythic?.[fx] : p.recipe
  if (!recipe) return { ...root, sub: p.free ? 'bedava, craft yok' : 'tarifi yok' }
  root.children.push({ key: 'r/pattern', ref: { kind: 'pattern' }, label: `${p.name} kalıbı`, tier, count: 1, children: [] })
  recipe.mats.forEach((s, i) => {
    const m = mats[s.mat]
    root.children.push({
      key: `r/${i}`,
      ref: { kind: 'wmat', id: s.mat },
      label: m?.name ?? s.mat,
      tier: m?.tier ?? null,
      count: s.count,
      sub: m ? undefined : 'bilinmeyen malzeme',
      index: i,
      children: [],
    })
  })
  if (fx) root.children.push({ key: 'r/c1', ref: { kind: 'color', area: 1, fx }, label: `${effectName(fx)} rengi`, tier: 'mythic', count: 1, children: [] })
  else {
    root.children.push({ key: 'r/c1', ref: { kind: 'color', area: 1 }, label: `Renk: ${colorKindsLabel(p.colors)}`, tier: null, count: p.colors.length ? 1 : undefined, children: [] })
    if (p.color2) root.children.push({ key: 'r/c2', ref: { kind: 'color', area: 2 }, label: `İkinci renk: ${colorKindsLabel(p.color2)}`, tier: null, count: 1, children: [] })
  }
  return root
}

/** Which parts (and Mythic copies) a wardrobe material goes into. */
export function materialUsedInTree(cat: WardrobeCatalog, matId: string): TreeNode {
  const m = (cat.materials ?? []).find((x) => x.id === matId)
  const root: TreeNode = { key: 'u', ref: { kind: 'wmat', id: matId }, label: m?.name ?? matId, tier: m?.tier ?? null, children: [] }
  let i = 0
  for (const p of cat.parts) {
    const add = (r: WardrobeRecipe | undefined, fx?: string) => {
      const s = r?.mats.find((x) => x.mat === matId)
      if (s)
        root.children.push({
          key: `u/${i++}`,
          ref: { kind: 'part', id: p.id, fx },
          label: (fx ? effectName(fx) + ' ' : '') + p.name,
          tier: fx ? 'mythic' : p.tier,
          count: s.count,
          sub: p.family,
          children: [],
        })
    }
    add(p.recipe)
    for (const fx of Object.keys(p.mythic ?? {})) add(p.mythic![fx], fx)
  }
  return root
}

const EFFECT_NAMES: Record<string, string> = {
  fx_rainbow: 'Rainbow',
  fx_flame: 'Flame',
  fx_ice: 'Ice',
  fx_galaxy: 'Galaxy',
  fx_deep_sea: 'Deep Sea',
  fx_forest: 'Forest',
  fx_storm: 'Storm',
  fx_shadow: 'Shadow',
  fx_crystal: 'Crystal',
  fx_aurora: 'Aurora',
  fx_sunset: 'Sunset',
  fx_gold: 'Golden Glow',
}
export const effectName = (fx: string) => EFFECT_NAMES[fx] ?? fx

/**
 * The family ladder recipe (craft table "Tarif otomatı", Öneri): base ×3-6 and the family's signature
 * materials for the part's Tier and the one below. Detail and special materials are added by hand.
 */
export function ladderRecipe(cat: WardrobeCatalog, p: WardrobePart): WardrobeRecipe | null {
  const f = (cat.families ?? []).find((x) => x.id === p.family)
  if (!f || !p.tier) return null
  const L = f.ladder
  const plan: Record<string, [string | null, number][]> = {
    common: [
      [f.base, 3],
      [L.common, 2],
    ],
    rare: [
      [f.base, 4],
      [L.rare, 2],
      [L.common, 2],
    ],
    epic: [
      [f.base, 5],
      [L.epic, 2],
      [L.rare, 2],
    ],
    legendary: [
      [f.base, 6],
      [L.legendary ?? L.epic, L.legendary ? 1 : 2],
      [L.epic, 2],
    ],
  }
  const mats: WardrobeRecipe['mats'] = []
  for (const [mat, count] of plan[p.tier] ?? []) {
    if (!mat) continue
    const same = mats.find((x) => x.mat === mat)
    if (same) same.count += count
    else mats.push({ mat, count })
  }
  return { mats }
}

export const TIER_ORDER: Record<string, number> = { '': 0, common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }
export const tierRank = (t: string | null | undefined) => TIER_ORDER[t ?? ''] ?? 9
