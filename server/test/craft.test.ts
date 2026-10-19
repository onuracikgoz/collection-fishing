import { describe, expect, it } from 'vitest';
import { BAG, CRAFT, ECONOMY, FLOAT_TABLE } from '../src/config';
import { LAKE_POOL } from '../src/data/lake-pool';
import { RECIPES, STARTER_RECIPES, recipeById } from '../src/data/recipes';
import { rollFloat } from '../src/rules/catch';
import { CraftItem, craftBands, parseCraft, parseMerge, planCraft, planMerge, qualityRow } from '../src/rules/craft';
import { planEconomy } from '../src/rules/economy';
import { seededRandom } from '../src/rules/rng';

const item = (instanceId: string, defId: string, float: number, tier: CraftItem['tier'] = 'common'): CraftItem => ({ instanceId, defId, tier, float });
const charm = recipeById('recipe.scale_charm')!;
const trophy = recipeById('recipe.pike_trophy')!;

describe('merge', () => {
  const three = [item('a', 'carp', 0.3), item('b', 'carp', 0.6), item('c', 'carp', 0.1)];

  it('takes three copies of one item and dust by Tier', () => {
    const r = planMerge(three, 100, CRAFT);
    expect(r).toMatchObject({ ok: true, dustCost: CRAFT.mergeDust.common, removeItems: ['a', 'b', 'c'], output: { defId: 'carp', tier: 'common' }, maxFloat: 0.6 });
    expect(r.ok && r.inputAverage).toBeCloseTo(1 / 3);
  });

  it('refuses mixed items and too little dust', () => {
    expect(planMerge([three[0], three[1], item('d', 'perch', 0.2)], 100, CRAFT)).toEqual({ ok: false, reason: 'NOT_SAME_ITEM' });
    expect(planMerge(three, CRAFT.mergeDust.common - 1, CRAFT)).toEqual({ ok: false, reason: 'NOT_ENOUGH_DUST' });
    expect(planMerge(three.slice(0, 2), 100, CRAFT)).toEqual({ ok: false, reason: 'NOT_OWNED' });
  });

  it('parses exactly three distinct ids', () => {
    expect(parseMerge({ items: ['a', 'b', 'c'] }, CRAFT)).toEqual(['a', 'b', 'c']);
    expect(parseMerge({ items: ['a', 'a', 'c'] }, CRAFT)).toBe(null);
    expect(parseMerge({ items: ['a', 'b'] }, CRAFT)).toBe(null);
    expect(parseMerge({ items: ['a', 'b', 'c', 'd'] }, CRAFT)).toBe(null);
  });
});

describe('craft', () => {
  const bag = { items: 5, stacks: { 'recipe.scale_charm': 1, 'lake.mat.scale': 5, 'lake.mat.moss': 1 } };

  it('spends the recipe, materials and dust', () => {
    const r = planCraft(charm, [], bag, 50, BAG, CRAFT);
    expect(r).toMatchObject({
      ok: true,
      dustCost: CRAFT.craftDust.common,
      removeItems: [],
      stacksAfter: { 'recipe.scale_charm': 0, 'lake.mat.scale': 2, 'lake.mat.moss': 0 },
      output: charm.output,
      inputAverage: null,
      maxFloat: 1,
    });
  });

  it('needs the recipe, every input and the dust', () => {
    expect(planCraft(charm, [], { ...bag, stacks: { ...bag.stacks, 'recipe.scale_charm': 0 } }, 50, BAG, CRAFT)).toEqual({ ok: false, reason: 'NO_RECIPE' });
    expect(planCraft(charm, [], { ...bag, stacks: { ...bag.stacks, 'lake.mat.scale': 2 } }, 50, BAG, CRAFT)).toEqual({ ok: false, reason: 'MISSING_INPUTS' });
    expect(planCraft(charm, [], bag, 19, BAG, CRAFT)).toEqual({ ok: false, reason: 'NOT_ENOUGH_DUST' });
    expect(planCraft(null, [], bag, 50, BAG, CRAFT)).toEqual({ ok: false, reason: 'BAD_REQUEST' });
  });

  it('takes exactly the Float items the recipe asks for', () => {
    const b = { items: 2, stacks: { 'recipe.pike_trophy': 1, 'lake.mat.scale': 2 } };
    const picks = [item('c1', 'craft.scale_charm', 0.1), item('p1', 'lake.fish.pike', 0.3, 'rare')];
    const r = planCraft(trophy, picks, b, 80, BAG, CRAFT);
    expect(r).toMatchObject({ ok: true, removeItems: ['c1', 'p1'], maxFloat: CRAFT.gradeMaxFloat.good });
    expect(r.ok && r.inputAverage).toBeCloseTo(0.2);
    expect(planCraft(trophy, picks.slice(0, 1), b, 80, BAG, CRAFT)).toEqual({ ok: false, reason: 'MISSING_INPUTS' });
    expect(planCraft(trophy, [...picks, item('x', 'lake.fish.carp', 0.1)], b, 80, BAG, CRAFT)).toEqual({ ok: false, reason: 'MISSING_INPUTS' });
  });

  it('needs a free slot for the result once the inputs are gone', () => {
    const full = { items: BAG.slots - 2, stacks: { 'recipe.moss_wreath': 2, 'lake.mat.moss': 4 } };
    expect(planCraft(recipeById('recipe.moss_wreath'), [], full, 50, BAG, CRAFT)).toEqual({ ok: false, reason: 'BAG_FULL' });
    // Using up the recipe and moss stacks frees their slots.
    const fits = { items: BAG.slots - 2, stacks: { 'recipe.moss_wreath': 1, 'lake.mat.moss': 3 } };
    expect(planCraft(recipeById('recipe.moss_wreath'), [], fits, 50, BAG, CRAFT).ok).toBe(true);
  });

  it('parses the request', () => {
    expect(parseCraft({ recipeId: 'r' }, 8)).toEqual({ recipeId: 'r', items: [] });
    expect(parseCraft({ recipeId: 'r', items: ['a', 'a'] }, 8)).toBe(null);
    expect(parseCraft({ items: [] }, 8)).toBe(null);
  });
});

describe('craft Float', () => {
  it('better inputs raise the Pristine and Excellent chances', () => {
    expect(qualityRow(0.01, CRAFT).pristine).toBeGreaterThan(qualityRow(0.7, CRAFT).pristine);
    expect(qualityRow(null, CRAFT)).toBe(CRAFT.qualityWithoutFloat);
  });

  it('keeps the base proportions for the other conditions', () => {
    const bands = craftBands(FLOAT_TABLE, 0.3, 1, CRAFT);
    const w = Object.fromEntries(bands.map((b) => [b.condition, b.weight]));
    expect(w.pristine).toBe(200);
    expect(w.excellent).toBe(1300);
    expect(w.normal / w.worn).toBeCloseTo(45 / 30);
  });

  it('never goes above the cap', () => {
    const random = seededRandom(7);
    for (const cap of [CRAFT.gradeMaxFloat.master, CRAFT.gradeMaxFloat.good, 0.37, 0]) {
      const bands = craftBands(FLOAT_TABLE, 0.6, cap, CRAFT);
      for (let i = 0; i < 2000; i++) expect(rollFloat(bands, random).value).toBeLessThanOrEqual(cap);
    }
    // Master grade means at least Excellent.
    expect(craftBands(FLOAT_TABLE, 0.6, 0.2, CRAFT).map((b) => b.condition)).toEqual(['pristine', 'excellent']);
  });
});

describe('recipe data', () => {
  it('every recipe drops from the lake and sells by grade', () => {
    for (const r of RECIPES) expect(LAKE_POOL.some((d) => d.id === r.id && d.category === 'recipe')).toBe(true);
    for (const s of STARTER_RECIPES) expect(recipeById(s.defId)).not.toBe(null);
    const sale = planEconomy('sell', { items: [], stacks: [{ defId: trophy.id, count: 1 }] }, {}, { [trophy.id]: 1 }, () => 'recipe', FLOAT_TABLE, ECONOMY, (id) => recipeById(id)!.grade);
    expect(sale.ok && sale.gained).toBe(ECONOMY.recipePrice.good);
    const salvage = planEconomy('salvage', { items: [], stacks: [{ defId: trophy.id, count: 1 }] }, {}, { [trophy.id]: 1 }, () => 'recipe', FLOAT_TABLE, ECONOMY);
    expect(salvage).toEqual({ ok: false, reason: 'CANNOT_SALVAGE' });
  });
});

describe('bait craft', () => {
  const bait = recipeById('recipe.shiny_bait')!;

  it('makes a stack of bait for the recipe dust, no Float, no book', () => {
    const bag = { items: 0, stacks: { 'recipe.shiny_bait': 1, 'lake.mat.scale': 2, 'lake.junk.shell': 1, 'bait.shiny': 3 } };
    const r = planCraft(bait, [], bag, 10, BAG, CRAFT);
    expect(r).toMatchObject({ ok: true, dustCost: 10, output: { defId: 'bait.shiny', count: 5 } });
    expect(planCraft(bait, [], bag, 9, BAG, CRAFT)).toEqual({ ok: false, reason: 'NOT_ENOUGH_DUST' });
  });

  it('a stack result can fill the last slot or join an open stack', () => {
    const stacks = { 'recipe.shiny_bait': 2, 'lake.mat.scale': 3, 'lake.junk.shell': 2 };
    // Inputs keep their slots, the 5 baits take the one free slot.
    expect(planCraft(bait, [], { items: BAG.slots - 4, stacks }, 10, BAG, CRAFT).ok).toBe(true);
    expect(planCraft(bait, [], { items: BAG.slots - 3, stacks }, 10, BAG, CRAFT)).toEqual({ ok: false, reason: 'BAG_FULL' });
    expect(planCraft(bait, [], { items: BAG.slots - 4, stacks: { ...stacks, 'bait.shiny': 10 } }, 10, BAG, CRAFT).ok).toBe(true);
  });
});
