// What comes out of the water. Pure functions, no Nakama dependency.
// Rules: docs/tasarim/03-balik-tutma.md (av tablosu), 05-esya-float.md (Float).
import { Random, pickWeighted } from './rng';
import { Band } from './water';

export type Tier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Category = 'junk' | 'common' | 'material' | 'rare' | 'epic' | 'recipe' | 'legendary' | 'mythic';
export type Condition = 'pristine' | 'excellent' | 'normal' | 'worn' | 'damaged';

export interface ItemDef {
  id: string;
  category: Category;
  /** Bands it can come from; all bands if missing. */
  bands?: Band[];
  /** Labels baits can favour, e.g. "crystal" (03-balik-tutma.md 5.0.0). */
  tags?: string[];
}

/** Category weights, integers (e.g. 2500 = %25). */
export type CatchTable = { [c in Category]?: number };

export interface FloatBand {
  condition: Condition;
  min: number;
  max: number;
  weight: number;
}

export interface CatchRoll {
  def: ItemDef;
  /** Null for junk, materials and recipes: they stack and have no Tier. */
  tier: Tier | null;
}

const TIER_OF: { [c in Category]?: Tier } = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
  mythic: 'mythic',
};

export function tierOf(category: Category): Tier | null {
  return TIER_OF[category] || null;
}

/**
 * Picks the catch at the moment the bobber sinks. Without energy only junk comes up.
 * A category with no item in this band falls back to junk.
 */
export function rollCatch(
  pool: ItemDef[],
  table: CatchTable,
  band: Band,
  hasEnergy: boolean,
  random: Random,
  tagBoost: { [tag: string]: number } | null = null,
): CatchRoll | null {
  const fits = (d: ItemDef) => !d.bands || d.bands.indexOf(band) >= 0;
  const category: Category | null = hasEnergy ? pickWeighted<Category>(table, random) : 'junk';
  if (category === null) return null;
  let options = pool.filter((d) => d.category === category && fits(d));
  if (options.length === 0) options = pool.filter((d) => d.category === 'junk' && fits(d));
  if (options.length === 0) return null;
  const def = tagBoost ? pickItem(options, tagBoost, random) : options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  return { def, tier: tierOf(def.category) };
}

/** Picks an item from one category, tagged items weighing more (a bait's tagBoost). */
function pickItem(options: ItemDef[], tagBoost: { [tag: string]: number }, random: Random): ItemDef {
  const weights = options.map((d) => {
    let w = 1;
    for (const t of d.tags || []) if (tagBoost[t] !== undefined) w *= tagBoost[t];
    return w;
  });
  let total = 0;
  for (const w of weights) total += w;
  let roll = random() * total;
  for (let i = 0; i < options.length; i++) {
    if (roll < weights[i]) return options[i];
    roll -= weights[i];
  }
  return options[options.length - 1];
}

/** Condition first by weight, then a value inside its range, 4 decimals. */
export function rollFloat(bands: FloatBand[], random: Random): { condition: Condition; value: number } {
  const weights: { [c in Condition]?: number } = {};
  for (const b of bands) weights[b.condition] = b.weight;
  const condition = pickWeighted<Condition>(weights, random) || bands[0].condition;
  const band = bands.filter((b) => b.condition === condition)[0];
  const raw = band.min + random() * (band.max - band.min);
  // Keep strictly below max so the value stays in its condition's range.
  const value = Math.min(Math.floor(raw * 10000) / 10000, band.max - 0.0001);
  return { condition, value: Math.max(band.min, value) };
}
