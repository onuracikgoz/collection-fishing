import { describe, expect, it } from 'vitest';
import { BAG, BAIT, CATCH, CATCH_TABLE, ROD } from '../src/config';
import { LAKE_POOL } from '../src/data/lake-pool';
import { applyBait, baitDef, baitFavour, parseBuyBait, planBuyBait } from '../src/rules/bait';
import { ItemDef, rollCatch } from '../src/rules/catch';
import { checkBait, parseCast } from '../src/rules/fishing';
import { isBroken, newRod, normalizeRod, planRepair, repairCost, rodView, wearRod } from '../src/rules/rod';
import { seededRandom } from '../src/rules/rng';

describe('rod', () => {
  it('starts full at level 1 and wears one point per catch', () => {
    const rod = newRod(ROD);
    expect(rodView(rod, ROD)).toEqual({ level: 1, durability: 200, max: 200 });
    let r = rod;
    for (let i = 0; i < 200; i++) r = wearRod(r, 'shore', ROD);
    expect(r.durability).toBe(0);
    expect(isBroken(r)).toBe(true);
    expect(wearRod(r, 'shore', ROD).durability).toBe(0);
  });

  it('deep water wears the rod twice as fast', () => {
    const rod = newRod(ROD);
    expect(rod.durability - wearRod(rod, 'shore', ROD).durability).toBe(1);
    expect(rod.durability - wearRod(rod, 'mid', ROD).durability).toBe(1);
    expect(rod.durability - wearRod(rod, 'deep', ROD).durability).toBe(2);
  });

  it('costs the full price from 0 and a share for a partial repair', () => {
    const broken = { level: 1, durability: 0 };
    expect(planRepair(broken, 1000, ROD)).toEqual({ ok: true, points: 200, cost: 100, rod: { level: 1, durability: 200 } });
    expect(planRepair({ level: 2, durability: 0 }, 1000, ROD)).toMatchObject({ cost: 150 });
    expect(planRepair({ level: 3, durability: 100 }, 1000, ROD)).toMatchObject({ points: 100, cost: 125 });
    // ~200 catches between repairs: 0.5 Coin per catch at level 1 (16-ekonomi-tablosu.md 4.2).
    expect(repairCost(broken, 1, ROD)).toBe(1);
    expect(repairCost(broken, 2, ROD)).toBe(1);
  });

  it('repairs as much as the Coin pays for', () => {
    expect(planRepair({ level: 1, durability: 0 }, 7, ROD)).toEqual({ ok: true, points: 14, cost: 7, rod: { level: 1, durability: 14 } });
    expect(planRepair({ level: 3, durability: 0 }, 1, ROD)).toEqual({ ok: false, reason: 'NOT_ENOUGH_COIN' });
    expect(planRepair({ level: 3, durability: 0 }, 2, ROD)).toMatchObject({ ok: true, points: 1, cost: 2 });
    expect(planRepair({ level: 1, durability: 0 }, 0, ROD)).toEqual({ ok: false, reason: 'NOT_ENOUGH_COIN' });
    expect(planRepair(newRod(ROD), 1000, ROD)).toEqual({ ok: false, reason: 'NOT_NEEDED' });
  });

  it('cleans stored values', () => {
    expect(normalizeRod(null, ROD)).toEqual(newRod(ROD));
    expect(normalizeRod({ level: 9, durability: 5 }, ROD)).toEqual(newRod(ROD));
    expect(normalizeRod({ level: 2, durability: 500 }, ROD)).toEqual({ level: 2, durability: 200 });
    expect(normalizeRod({ level: 1, durability: -3 }, ROD)).toEqual({ level: 1, durability: 0 });
  });
});

describe('bait', () => {
  it('shifts Rare and up without touching the rest', () => {
    const t = applyBait(CATCH_TABLE, baitDef('bait.shiny', BAIT), 'shore');
    expect(t.rare).toBe(Math.round(CATCH_TABLE.rare * 1.3));
    expect(t.mythic).toBe(Math.round(CATCH_TABLE.mythic * 1.2));
    expect(t.junk).toBe(CATCH_TABLE.junk);
    expect(t.common).toBe(CATCH_TABLE.common);
  });

  it('crystal bait only works in deep water', () => {
    const crystal = baitDef('bait.crystal', BAIT);
    expect(applyBait(CATCH_TABLE, crystal, 'mid')).toBe(CATCH_TABLE);
    expect(baitFavour('bait.crystal', 'mid', BAIT, 3)).toBe(null);
    expect(baitFavour('bait.crystal', 'shore', BAIT, 3)).toBe(null);
    expect(applyBait(CATCH_TABLE, crystal, 'deep').mythic).toBe(CATCH_TABLE.mythic * 2);
    expect(baitFavour('bait.crystal', 'deep', BAIT, 3)).toEqual({ bait: 'bait.crystal', factor: 3 });
    expect(baitFavour(undefined, 'deep', BAIT, 3)).toBe(null);
    expect(baitFavour('bait.unknown', 'deep', BAIT, 3)).toBe(null);
    expect(applyBait(CATCH_TABLE, null, 'deep')).toBe(CATCH_TABLE);
  });

  it('makes items listing the bait come up more often inside their category, never new ones', () => {
    const pool: ItemDef[] = [
      { id: 'plain', category: 'rare' },
      { id: 'crystal', category: 'rare', baits: ['bait.crystal'] },
    ];
    const spot = { band: 'deep' as const, water: null, level: 1 };
    const count = (favour: { bait: string; factor: number } | null) => {
      const random = seededRandom(11);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (rollCatch(pool, { rare: 1 }, spot, true, random, favour)!.def.id === 'crystal') n++;
      return n / 4000;
    };
    expect(count(null)).toBeCloseTo(0.5, 1);
    expect(count({ bait: 'bait.crystal', factor: CATCH.baitItemFactor })).toBeCloseTo(0.75, 1);
    expect(count({ bait: 'bait.shiny', factor: CATCH.baitItemFactor })).toBeCloseTo(0.5, 1);
    // Every bait result is still in the lake pool for that band.
    const random = seededRandom(3);
    const table = applyBait(CATCH_TABLE, baitDef('bait.crystal', BAIT), 'deep');
    for (let i = 0; i < 2000; i++) {
      const r = rollCatch(LAKE_POOL, table, { band: 'shore', water: 'buyuk_gol', level: 1 }, true, random, { bait: 'bait.crystal', factor: 3 })!;
      expect(!r.def.bands || r.def.bands.indexOf('shore') >= 0).toBe(true);
    }
  });

  it('a cast with bait needs the bait, energy and a whole rod', () => {
    expect(parseCast({ x: 1, y: 2, bait: 'bait.shiny' })).toEqual({ x: 1, y: 2, bait: 'bait.shiny' });
    expect(parseCast({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(parseCast({ x: 1, y: 2, bait: 5 })).toBe(null);
    const stacks = { 'bait.shiny': 2 };
    expect(checkBait('bait.shiny', true, stacks, true, false)).toEqual({ ok: true });
    expect(checkBait('bait.crystal', true, stacks, true, false)).toEqual({ ok: false, reason: 'NO_BAIT' });
    expect(checkBait('lake.junk.boot', false, { 'lake.junk.boot': 3 }, true, false)).toEqual({ ok: false, reason: 'NO_BAIT' });
    expect(checkBait('bait.shiny', true, stacks, false, false)).toEqual({ ok: false, reason: 'NO_ENERGY' });
    expect(checkBait('bait.shiny', true, stacks, false, true)).toEqual({ ok: false, reason: 'ROD_BROKEN' });
  });

  it('buys bait into the bag for Coin', () => {
    expect(parseBuyBait({ defId: 'bait.shiny', count: 10 }, BAIT)).toEqual({ defId: 'bait.shiny', count: 10 });
    expect(parseBuyBait({ defId: 'bait.shiny', count: 0 }, BAIT)).toBe(null);
    expect(parseBuyBait({ defId: 'bait.shiny', count: 100 }, BAIT)).toBe(null);
    expect(parseBuyBait({ defId: 'toString', count: 1 }, BAIT)).toBe(null);
    const bag = { items: 0, stacks: { 'bait.shiny': 3 } };
    expect(planBuyBait('bait.shiny', 10, 50, bag, BAG, BAIT)).toEqual({ ok: true, cost: 50, count: 13 });
    expect(planBuyBait('bait.crystal', 3, 59, bag, BAG, BAIT)).toEqual({ ok: false, reason: 'NOT_ENOUGH_COIN' });
    const full = { items: BAG.slots - 1, stacks: { 'bait.shiny': 98 } };
    expect(planBuyBait('bait.shiny', 1, 100, full, BAG, BAIT).ok).toBe(true);
    expect(planBuyBait('bait.shiny', 2, 100, full, BAG, BAIT)).toEqual({ ok: false, reason: 'BAG_FULL' });
  });
});
