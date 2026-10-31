// The "general" drop chance shown next to an item: its category's share of the catch table times
// its weight among the items of that category. Bands, waters, level, bait and book luck move the
// real chance at a given spot (03-balik-tutma.md); this is the plain average over the whole pool.
import type { ContentRuntime } from './content'

export interface Chance {
  /** 0..1 */
  chance: number
  categoryShare: number
  /** Items sharing the category. */
  rivals: number
}

export function generalChance(rt: ContentRuntime, defId: string): Chance | null {
  const def = rt.pool.find((d) => d.id === defId)
  if (!def) return null
  let total = 0
  for (const k in rt.catchTable) total += rt.catchTable[k as keyof typeof rt.catchTable] || 0
  if (total <= 0) return { chance: 0, categoryShare: 0, rivals: 0 }
  const same = rt.pool.filter((d) => d.category === def.category)
  const weights = same.reduce((a, d) => a + (d.weight ?? 1), 0)
  const categoryShare = (rt.catchTable[def.category] || 0) / total
  return { chance: (categoryShare * (def.weight ?? 1)) / weights, categoryShare, rivals: same.length }
}

export function percent(v: number): string {
  if (v === 0) return '%0'
  if (v >= 0.1) return `%${(v * 100).toFixed(1)}`
  if (v >= 0.001) return `%${(v * 100).toFixed(2)}`
  return `%${(v * 100).toFixed(4)}`
}
