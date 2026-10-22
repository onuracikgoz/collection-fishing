import { describe, expect, it } from 'vitest';
import { BAIT, CRAFT, ECONOMY, FLOAT_TABLE, ROD, STASH } from '../src/config';
import { LAKE_POOL } from '../src/data/lake-pool';
import { RECIPES } from '../src/data/recipes';
import { buildCatalog } from '../src/rules/catalog';

const catalog = buildCatalog({ pool: LAKE_POOL, recipes: RECIPES, bands: FLOAT_TABLE, economy: ECONOMY, craft: CRAFT, bait: BAIT, rod: ROD, stash: STASH });
const stack = (defId: string) => catalog.stacks.find((s) => s.defId === defId);

describe('get_catalog', () => {
  it('lists Tier prices and condition multipliers from the config', () => {
    expect(catalog.tiers.find((t) => t.tier === 'rare')).toEqual({ tier: 'rare', sell: 25, dust: 25, merge: 50, craft: 80 });
    expect(catalog.conditions[0]).toEqual({ condition: 'pristine', min: 0, max: 0.05, multiplier: 3 });
    expect(catalog.conditions).toHaveLength(FLOAT_TABLE.length);
  });

  it('prices stacks like the economy rules: recipes by grade, baits not at all', () => {
    expect(stack('lake.junk.boot')).toEqual({ defId: 'lake.junk.boot', category: 'junk', sell: 1, dust: 1 });
    expect(stack('lake.mat.scale')).toEqual({ defId: 'lake.mat.scale', category: 'material', sell: 3, dust: 2 });
    expect(stack('recipe.pike_trophy')).toEqual({ defId: 'recipe.pike_trophy', category: 'recipe', sell: 250, dust: 0 });
    expect(stack('bait.shiny')).toEqual({ defId: 'bait.shiny', category: 'bait', sell: 0, dust: 0 });
    // Float items are priced by Tier, not listed here.
    expect(stack('lake.fish.carp')).toBeUndefined();
  });

  it('gives each recipe its dust cost and output in a JsonUtility-friendly shape', () => {
    const trophy = catalog.recipes.find((r) => r.id === 'recipe.pike_trophy')!;
    expect(trophy.output).toEqual({ defId: 'craft.pike_trophy', tier: 'rare', count: 0 });
    expect(trophy.dust).toBe(80);
    expect(trophy.maxFloat).toBe(0.5);
    const bait = catalog.recipes.find((r) => r.id === 'recipe.shiny_bait')!;
    expect(bait.output).toEqual({ defId: 'bait.shiny', tier: '', count: 5 });
    expect(bait.dust).toBe(10);
  });

  it('lists quality steps, baits, rod repair and stash tiers without where baits work', () => {
    expect(catalog.qualitySteps).toEqual([0.05, 0.2, 0.5]);
    expect(catalog.baits).toEqual([{ defId: 'bait.shiny', price: 5 }, { defId: 'bait.crystal', price: 20 }]);
    expect(JSON.stringify(catalog)).not.toContain('deep');
    expect(catalog.rodLevels[0]).toEqual({ level: 1, max: 200, fullRepair: 100 });
    expect(catalog.stash).toMatchObject({ x: 30.5, y: 78.5, range: 3, baseSlots: 100 });
    expect(catalog.stash.tiers[0]).toEqual({ slots: 120, price: 2000 });
  });
});
