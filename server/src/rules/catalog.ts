// The read-only price and recipe list the client shows in its Faz 4 windows (get_catalog).
// Only display data: every result is still decided by the economy, craft, rod, bait and stash rules.
// Pure function, no Nakama dependency.
import { BaitConfig } from './bait';
import { Category, Condition, FloatBand, ItemDef, Tier } from './catch';
import { CraftConfig, RecipeDef, isStackOutput } from './craft';
import { EconomyConfig } from './economy';
import { RodConfig } from './rod';
import { StashConfig } from './stash';

const TIERS: Tier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

/** Arrays only, so Unity's JsonUtility can read it (no maps, no optional numbers). */
export interface CatalogResponse {
  /** Per Tier: NPC price before condition, salvage dust, merge dust, craft dust. */
  tiers: { tier: Tier; sell: number; dust: number; merge: number; craft: number }[];
  /** Float bands and their NPC price multiplier. */
  conditions: { condition: Condition; min: number; max: number; multiplier: number }[];
  /** Stackable things (junk, materials, recipes, baits). 0 = the NPC does not buy it / it cannot be salvaged. */
  stacks: { defId: string; category: string; sell: number; dust: number }[];
  maxEntries: number;
  mergeCount: number;
  recipes: {
    id: string;
    grade: string;
    /** tier is "" and count > 0 for stack outputs (bait). */
    output: { defId: string; tier: string; count: number };
    dust: number;
    stacks: { defId: string; count: number }[];
    items: { defId: string; count: number }[];
    /** Worst Float this grade can produce. */
    maxFloat: number;
  }[];
  /** Input Float averages where the quality chance steps up, best first (shown as a word, never as a percent). */
  qualitySteps: number[];
  /** Shop baits and their price. Where a bait works is not listed (keşif konusu). */
  baits: { defId: string; price: number }[];
  maxBuy: number;
  rodLevels: { level: number; max: number; fullRepair: number }[];
  stash: { x: number; y: number; range: number; baseSlots: number; maxEntries: number; tiers: { slots: number; price: number }[] };
}

export interface CatalogSources {
  pool: ItemDef[];
  recipes: RecipeDef[];
  bands: FloatBand[];
  economy: EconomyConfig;
  craft: CraftConfig;
  bait: BaitConfig;
  rod: RodConfig;
  stash: StashConfig;
}

const STACK_CATEGORIES: Category[] = ['junk', 'material', 'recipe'];

export function buildCatalog(s: CatalogSources): CatalogResponse {
  const grades: { [defId: string]: string } = {};
  for (const r of s.recipes) grades[r.id] = r.grade;

  const stacks: CatalogResponse['stacks'] = [];
  for (const d of s.pool) {
    if (STACK_CATEGORIES.indexOf(d.category) < 0) continue;
    const grade = d.category === 'recipe' ? grades[d.id] : undefined;
    const sell = grade ? s.economy.recipePrice[grade as keyof EconomyConfig['recipePrice']] : s.economy.sellPrice[d.category];
    const dust = s.economy.dust[d.category];
    stacks.push({ defId: d.id, category: d.category, sell, dust: dust === null ? 0 : dust });
  }
  // Baits are bought, never sold or salvaged.
  for (const defId of Object.keys(s.bait.baits)) stacks.push({ defId, category: 'bait', sell: 0, dust: 0 });

  const rodLevels = Object.keys(s.rod.levels)
    .map(Number)
    .sort((a, b) => a - b)
    .map((level) => ({ level, max: s.rod.levels[level].max, fullRepair: s.rod.levels[level].fullRepair }));

  return {
    tiers: TIERS.map((tier) => ({
      tier,
      sell: s.economy.sellPrice[tier],
      dust: s.economy.dust[tier] ?? 0,
      merge: s.craft.mergeDust[tier],
      craft: s.craft.craftDust[tier],
    })),
    conditions: s.bands.map((b) => ({ condition: b.condition, min: b.min, max: b.max, multiplier: s.economy.conditionMultiplier[b.condition] })),
    stacks,
    maxEntries: s.economy.maxEntries,
    mergeCount: s.craft.mergeCount,
    recipes: s.recipes.map((r) => ({
      id: r.id,
      grade: r.grade,
      output: isStackOutput(r.output)
        ? { defId: r.output.defId, tier: '', count: r.output.count }
        : { defId: r.output.defId, tier: r.output.tier, count: 0 },
      dust: isStackOutput(r.output) ? r.dust ?? 0 : s.craft.craftDust[r.output.tier],
      stacks: r.stacks.map((x) => ({ defId: x.defId, count: x.count })),
      items: r.items.map((x) => ({ defId: x.defId, count: x.count })),
      maxFloat: s.craft.gradeMaxFloat[r.grade],
    })),
    // The last row covers everything else, so its edge is not a step.
    qualitySteps: s.craft.quality.slice(0, -1).map((q) => q.below),
    baits: Object.keys(s.bait.baits).map((defId) => ({ defId, price: s.bait.baits[defId].price })),
    maxBuy: s.bait.maxBuy,
    rodLevels,
    stash: {
      x: s.stash.bank.x,
      y: s.stash.bank.y,
      range: s.stash.range,
      baseSlots: s.stash.baseSlots,
      maxEntries: s.stash.maxEntries,
      tiers: s.stash.tiers.map((t) => ({ slots: t.slots, price: t.price })),
    },
  };
}
