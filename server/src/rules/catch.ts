// What comes out of the water. Pure functions, no Nakama dependency.
// Rules: docs/tasarim/03-balik-tutma.md (av tablosu), 05-esya-float.md (Float).
import { Random, pickWeighted } from './rng';
import { Band } from './water';

export type Tier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Category = 'junk' | 'common' | 'material' | 'rare' | 'epic' | 'recipe' | 'legendary' | 'mythic';
export type Condition = 'pristine' | 'excellent' | 'normal' | 'worn' | 'damaged';

/**
 * One thing that can come out of the water. The catch fields say where and
 * when (03-balik-tutma.md "Eşyanın çıkış alanları"); a missing field means no
 * limit. They are server data: the client and the book never show them.
 */
export interface ItemDef {
  id: string;
  category: Category;
  /** Named waters it comes from (map file `waters`); every water if missing. */
  waters?: string[];
  /** Bands it can come from; all bands if missing. */
  bands?: Band[];
  /** Special baits that make it come up more often inside its category. */
  baits?: string[];
  /** Lowest player level it comes up for; level 1 if missing. */
  minLevel?: number;
}

/** Category weights, integers (e.g. 2500 = %25). */
export type CatchTable = { [c in Category]?: number };

/** Where and by whom a cast is made: what decides which items are in the pool. */
export interface CatchSpot {
  band: Band;
  /** Named water at the bobber, null if the map gives it no name. */
  water: string | null;
  level: number;
}

/** A special bait that favours the items listing it, and by how much. */
export interface ItemFavour {
  bait: string;
  factor: number;
}

export interface CatchConfig {
  /** Category weight multipliers per band, e.g. more materials on the shore. */
  bandBoost: { [b in Band]?: { [c in Category]?: number } };
  /** Weight of an item inside its category when cast with one of its `baits`. */
  baitItemFactor: number;
}

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

/** True if the item can come up at this spot for this player. */
export function itemFits(d: ItemDef, spot: CatchSpot): boolean {
  if (d.bands && d.bands.indexOf(spot.band) < 0) return false;
  if (d.waters && (spot.water === null || d.waters.indexOf(spot.water) < 0)) return false;
  return !d.minLevel || spot.level >= d.minLevel;
}

/** The items that can come up at this spot. */
export function poolAt(pool: ItemDef[], spot: CatchSpot): ItemDef[] {
  return pool.filter((d) => itemFits(d, spot));
}

/** The catch table with the band's category multipliers applied (e.g. materials on the shore). */
export function applyBand(table: CatchTable, band: Band, cfg: CatchConfig): CatchTable {
  const boost = cfg.bandBoost[band];
  if (!boost) return table;
  const out: CatchTable = {};
  for (const k in table) {
    const c = k as Category;
    const m = boost[c];
    out[c] = m !== undefined ? Math.round((table[c] || 0) * m) : table[c];
  }
  return out;
}

/**
 * Picks the catch at the moment the bobber sinks. Without energy only junk comes up.
 * Only items that fit the spot can come up; a category with none of them falls back
 * to junk, so a low level player gets something else instead of a locked item.
 */
export function rollCatch(
  pool: ItemDef[],
  table: CatchTable,
  spot: CatchSpot,
  hasEnergy: boolean,
  random: Random,
  favour: ItemFavour | null = null,
): CatchRoll | null {
  const fits = (d: ItemDef) => itemFits(d, spot);
  const category: Category | null = hasEnergy ? pickWeighted<Category>(table, random) : 'junk';
  if (category === null) return null;
  let options = pool.filter((d) => d.category === category && fits(d));
  if (options.length === 0) options = pool.filter((d) => d.category === 'junk' && fits(d));
  if (options.length === 0) return null;
  const def = favour ? pickItem(options, favour, random) : options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  return { def, tier: tierOf(def.category) };
}

/** Picks an item from one category, items listing the bait weighing more. Never adds items. */
function pickItem(options: ItemDef[], favour: ItemFavour, random: Random): ItemDef {
  const weights = options.map((d) => (d.baits && d.baits.indexOf(favour.bait) >= 0 ? favour.factor : 1));
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
