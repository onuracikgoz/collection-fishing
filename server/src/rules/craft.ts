// Merge (3 into 1) and recipe crafting. Pure functions, no Nakama dependency.
// Rules: docs/tasarim/07-kopya-envanter.md 9.4, 08-recipe-craft.md 10-11, costs 16-ekonomi-tablosu.md 4.3-4.4.
import { BagConfig, BagSummary, slotsUsed } from './bag';
import { Condition, FloatBand, Tier } from './catch';

export type RecipeGrade = 'normal' | 'good' | 'master';

/** A Float item with a Tier, or a stack (e.g. special bait) with a count. */
export type RecipeOutput = { defId: string; tier: Tier } | { defId: string; count: number };

export function isStackOutput(o: RecipeOutput): o is { defId: string; count: number } {
  return (o as { count?: number }).count !== undefined;
}

export interface RecipeDef {
  /** The recipe item's definition id; one is spent per craft. */
  id: string;
  grade: RecipeGrade;
  output: RecipeOutput;
  /** Dust for stack outputs, which have no Tier to price by. */
  dust?: number;
  /** Stackable inputs (materials, junk). */
  stacks: { defId: string; count: number }[];
  /** Float item inputs; the player picks which copies. */
  items: { defId: string; count: number }[];
}

/** One row of the quality table: applies when the input average is below `below`. */
export interface QualityRow {
  below: number;
  pristine: number;
  excellent: number;
}

export interface CraftConfig {
  mergeCount: number;
  mergeDust: { [t in Tier]: number };
  craftDust: { [t in Tier]: number };
  /** Rows sorted by `below`, best first; the last row covers everything else. */
  quality: QualityRow[];
  /** Row used when a recipe has no Float inputs (materials have no Float). */
  qualityWithoutFloat: QualityRow;
  /** Worst Float a recipe grade can produce. */
  gradeMaxFloat: { [g in RecipeGrade]: number };
}

/** A bag item as the rules need it. */
export interface CraftItem {
  instanceId: string;
  defId: string;
  tier: Tier;
  float: number;
}

export type CraftReason =
  | 'BAD_REQUEST'
  | 'NOT_OWNED'
  | 'NOT_SAME_ITEM'
  | 'NO_RECIPE'
  | 'MISSING_INPUTS'
  | 'NOT_ENOUGH_DUST'
  | 'BAG_FULL';

export interface CraftPlan {
  ok: true;
  dustCost: number;
  removeItems: string[];
  /** Changed stack counts after the action; 0 means the stack is gone. */
  stacksAfter: { [defId: string]: number };
  output: RecipeOutput;
  /** Average Float of the Float inputs, null if there were none. */
  inputAverage: number | null;
  /** The result's Float is at most this. */
  maxFloat: number;
}

export type CraftResult = CraftPlan | { ok: false; reason: CraftReason };

const ID_MAX = 64;

function idList(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: string[] = [];
  for (const id of v) {
    if (typeof id !== 'string' || id.length === 0 || id.length > ID_MAX || out.indexOf(id) >= 0) return null;
    out.push(id);
  }
  return out;
}

/** MERGE body: `{ items: [instanceId x3] }`. */
export function parseMerge(body: unknown, cfg: CraftConfig): string[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const items = idList((body as { items?: unknown }).items, cfg.mergeCount);
  return items && items.length === cfg.mergeCount ? items : null;
}

/** CRAFT body: `{ recipeId, items?: [instanceId] }`. */
export function parseCraft(body: unknown, maxItems: number): { recipeId: string; items: string[] } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { recipeId?: unknown; items?: unknown };
  if (typeof b.recipeId !== 'string' || b.recipeId.length === 0 || b.recipeId.length > ID_MAX) return null;
  const items = b.items === undefined ? [] : idList(b.items, maxItems);
  return items ? { recipeId: b.recipeId, items } : null;
}

function average(items: CraftItem[]): number | null {
  if (items.length === 0) return null;
  let sum = 0;
  for (const i of items) sum += i.float;
  return sum / items.length;
}

/**
 * Three copies of the same item plus dust make one copy with a new Float.
 * Tier does not change and the result is never worse than the worst input.
 */
export function planMerge(selected: CraftItem[], dust: number, cfg: CraftConfig): CraftResult {
  if (selected.length !== cfg.mergeCount) return { ok: false, reason: 'NOT_OWNED' };
  const first = selected[0];
  for (const i of selected) if (i.defId !== first.defId || i.tier !== first.tier) return { ok: false, reason: 'NOT_SAME_ITEM' };
  const cost = cfg.mergeDust[first.tier];
  if (dust < cost) return { ok: false, reason: 'NOT_ENOUGH_DUST' };
  let worst = 0;
  for (const i of selected) worst = Math.max(worst, i.float);
  return {
    ok: true,
    dustCost: cost,
    removeItems: selected.map((i) => i.instanceId),
    stacksAfter: {},
    output: { defId: first.defId, tier: first.tier },
    inputAverage: average(selected),
    maxFloat: worst,
  };
}

/**
 * Recipe + inputs + dust make a new item. The recipe is spent.
 * `selected` are the Float items the player picked; they must match the recipe exactly.
 */
export function planCraft(
  recipe: RecipeDef | null,
  selected: CraftItem[],
  bag: BagSummary,
  dust: number,
  bagCfg: BagConfig,
  cfg: CraftConfig,
): CraftResult {
  if (!recipe) return { ok: false, reason: 'BAD_REQUEST' };
  if ((bag.stacks[recipe.id] || 0) < 1) return { ok: false, reason: 'NO_RECIPE' };

  const need: { [defId: string]: number } = { [recipe.id]: 1 };
  for (const s of recipe.stacks) need[s.defId] = (need[s.defId] || 0) + s.count;
  for (const defId in need) if ((bag.stacks[defId] || 0) < need[defId]) return { ok: false, reason: 'MISSING_INPUTS' };

  const want: { [defId: string]: number } = {};
  for (const r of recipe.items) want[r.defId] = (want[r.defId] || 0) + r.count;
  const got: { [defId: string]: number } = {};
  for (const i of selected) got[i.defId] = (got[i.defId] || 0) + 1;
  for (const defId in want) if (got[defId] !== want[defId]) return { ok: false, reason: 'MISSING_INPUTS' };
  for (const defId in got) if (!want[defId]) return { ok: false, reason: 'MISSING_INPUTS' };

  const out = recipe.output;
  const cost = isStackOutput(out) ? recipe.dust || 0 : cfg.craftDust[out.tier];
  if (dust < cost) return { ok: false, reason: 'NOT_ENOUGH_DUST' };

  const stacksAfter: { [defId: string]: number } = {};
  const after: { [defId: string]: number } = { ...bag.stacks };
  for (const defId in need) {
    stacksAfter[defId] = bag.stacks[defId] - need[defId];
    if (stacksAfter[defId] > 0) after[defId] = stacksAfter[defId];
    else delete after[defId];
  }
  // The result needs room once the inputs are gone.
  const items = bag.items - selected.length;
  if (isStackOutput(out)) {
    after[out.defId] = (after[out.defId] || 0) + out.count;
    if (slotsUsed({ items, stacks: after }, bagCfg) > bagCfg.slots) return { ok: false, reason: 'BAG_FULL' };
  } else if (slotsUsed({ items, stacks: after }, bagCfg) >= bagCfg.slots) return { ok: false, reason: 'BAG_FULL' };

  return {
    ok: true,
    dustCost: cost,
    removeItems: selected.map((i) => i.instanceId),
    stacksAfter,
    output: recipe.output,
    inputAverage: average(selected),
    maxFloat: cfg.gradeMaxFloat[recipe.grade],
  };
}

export function qualityRow(inputAverage: number | null, cfg: CraftConfig): QualityRow {
  if (inputAverage === null) return cfg.qualityWithoutFloat;
  for (const r of cfg.quality) if (inputAverage < r.below) return r;
  return cfg.quality[cfg.quality.length - 1];
}

/**
 * Float bands for a craft result: the quality row sets the Pristine and
 * Excellent weights, the rest keep their base proportions, and every band is
 * cut at `maxFloat`. Pass the result to rollFloat.
 */
export function craftBands(base: FloatBand[], inputAverage: number | null, maxFloat: number, cfg: CraftConfig): FloatBand[] {
  const row = qualityRow(inputAverage, cfg);
  const fixed: { [c in Condition]?: number } = { pristine: row.pristine, excellent: row.excellent };
  let restBase = 0;
  for (const b of base) if (fixed[b.condition] === undefined) restBase += b.weight;
  const restShare = Math.max(0, 100 - row.pristine - row.excellent);
  const out: FloatBand[] = [];
  for (const b of base) {
    // A band starting at the cap would only produce the cap itself, which reads as the worse condition.
    if (b.min >= maxFloat && b.min > 0) continue;
    const weight = fixed[b.condition] !== undefined ? fixed[b.condition]! : restBase > 0 ? (b.weight / restBase) * restShare : 0;
    // Weights stay integers for pickWeighted; x100 keeps two decimals.
    out.push({ condition: b.condition, min: b.min, max: Math.min(b.max, maxFloat), weight: Math.round(weight * 100) });
  }
  return out;
}
