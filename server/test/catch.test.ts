import { describe, expect, it } from 'vitest';
import { BAIT, CATCH, CATCH_TABLE, FLOAT_TABLE } from '../src/config';
import { LAKE_MAP } from '../src/data/lake-map';
import { LAKE_POOL } from '../src/data/lake-pool';
import { CatchSpot, ItemDef, applyBand, itemFits, poolAt, rollCatch, rollFloat } from '../src/rules/catch';
import { seededRandom } from '../src/rules/rng';
import { Band } from '../src/rules/water';

const at = (band: Band, water: string | null = 'buyuk_gol', level = 1): CatchSpot => ({ band, water, level });

describe('rollCatch', () => {
  it('follows the catch table over many casts', () => {
    const random = seededRandom(1);
    const counts: { [k: string]: number } = {};
    const n = 200000;
    for (let i = 0; i < n; i++) {
      const r = rollCatch(LAKE_POOL, CATCH_TABLE, at('deep'), true, random)!;
      counts[r.def.category] = (counts[r.def.category] || 0) + 1;
    }
    expect(counts.junk / n).toBeCloseTo(0.25, 2);
    expect(counts.common / n).toBeCloseTo(0.5, 2);
    expect(counts.rare / n).toBeCloseTo(0.09, 2);
    expect(counts.mythic / n).toBeLessThan(0.002);
    expect(counts.recipe / n).toBeCloseTo(0.004, 3);
  });

  it('gives only junk without energy', () => {
    const random = seededRandom(2);
    for (let i = 0; i < 1000; i++) expect(rollCatch(LAKE_POOL, CATCH_TABLE, at('deep'), false, random)!.def.category).toBe('junk');
  });

  it('never gives an item outside its bands, falling back to junk', () => {
    const random = seededRandom(3);
    for (let i = 0; i < 20000; i++) {
      const r = rollCatch(LAKE_POOL, CATCH_TABLE, at('shore'), true, random)!;
      expect(!r.def.bands || r.def.bands.indexOf('shore') >= 0).toBe(true);
    }
  });

  it('sets a tier only for Float items', () => {
    const pool: ItemDef[] = [{ id: 'j', category: 'junk' }, { id: 'r', category: 'rare' }];
    expect(rollCatch(pool, { junk: 1 }, at('shore'), true, () => 0)!.tier).toBeNull();
    expect(rollCatch(pool, { rare: 1 }, at('shore'), true, () => 0)!.tier).toBe('rare');
  });
});

describe('catch fields', () => {
  const pool: ItemDef[] = [
    { id: 'junk', category: 'junk' },
    { id: 'any', category: 'rare' },
    { id: 'cave', category: 'rare', waters: ['magara_golu'] },
    { id: 'shore', category: 'rare', bands: ['shore'] },
    { id: 'veteran', category: 'rare', minLevel: 10 },
  ];

  it('an empty field means no limit', () => {
    expect(itemFits(pool[1], at('deep', null, 1))).toBe(true);
  });

  it('filters by water, band and level', () => {
    const ids = (s: CatchSpot) => poolAt(pool, s).map((d) => d.id);
    expect(ids(at('shore', 'buyuk_gol', 1))).toEqual(['junk', 'any', 'shore']);
    expect(ids(at('deep', 'magara_golu', 1))).toEqual(['junk', 'any', 'cave']);
    expect(ids(at('mid', null, 1))).toEqual(['junk', 'any']);
    expect(ids(at('mid', 'buyuk_gol', 10))).toEqual(['junk', 'any', 'veteran']);
  });

  it('a locked item gives its place to another item of the same category', () => {
    const random = seededRandom(5);
    for (let i = 0; i < 2000; i++) {
      const r = rollCatch(pool, { rare: 1 }, at('mid', 'buyuk_gol', 3), true, random)!;
      expect(r.def.id).toBe('any');
    }
    // Nothing of that category fits: junk instead.
    expect(rollCatch(pool.filter((d) => d.id !== 'any'), { rare: 1 }, at('mid', null, 1), true, random)!.def.id).toBe('junk');
  });

  it('every bait listed on an item is a shop bait and every water exists on the map', () => {
    const names = (LAKE_MAP.waterAreas || []).map((a) => a.id);
    for (const d of LAKE_POOL) {
      for (const b of d.baits || []) expect(BAIT.baits[b], `${d.id} bait ${b}`).toBeDefined();
      for (const w of d.waters || []) expect(names, `${d.id} water ${w}`).toContain(w);
    }
  });

  it('shore and deep water each have high Tier records of their own', () => {
    for (const band of ['shore', 'deep'] as Band[]) {
      const only = LAKE_POOL.filter((d) => d.bands && d.bands.length === 1 && d.bands[0] === band);
      expect(only.some((d) => d.category === 'epic' || d.category === 'legendary' || d.category === 'mythic'), band).toBe(true);
    }
  });
});

describe('band balance', () => {
  it('applies the band multipliers and leaves the rest alone', () => {
    const cfg = { bandBoost: { shore: { material: 2 }, deep: { material: 0.5, mythic: 2 } }, baitItemFactor: 3 };
    const shore = applyBand(CATCH_TABLE, 'shore', cfg);
    const deep = applyBand(CATCH_TABLE, 'deep', cfg);
    expect(shore.material).toBe(CATCH_TABLE.material * 2);
    expect(shore.rare).toBe(CATCH_TABLE.rare);
    expect(deep.material).toBe(CATCH_TABLE.material * 0.5);
    expect(deep.mythic).toBe(CATCH_TABLE.mythic * 2);
    expect(applyBand(CATCH_TABLE, 'mid', cfg)).toBe(CATCH_TABLE);
  });

  it('materials weigh most on the shore and least in deep water', () => {
    const m = (b: Band) => applyBand(CATCH_TABLE, b, CATCH).material!;
    expect(m('shore')).toBeGreaterThan(m('mid'));
    expect(m('mid')).toBeGreaterThan(m('deep'));
  });

  it('shore catches give more materials than deep ones over many casts', () => {
    const count = (band: Band) => {
      const random = seededRandom(8);
      const table = applyBand(CATCH_TABLE, band, CATCH);
      let n = 0;
      for (let i = 0; i < 50000; i++) if (rollCatch(LAKE_POOL, table, at(band), true, random)!.def.category === 'material') n++;
      return n / 50000;
    };
    expect(count('shore')).toBeGreaterThan(count('deep') * 3);
  });
});

describe('rollFloat', () => {
  it('keeps the value inside its condition and follows the weights', () => {
    const random = seededRandom(4);
    let pristine = 0;
    for (let i = 0; i < 50000; i++) {
      const f = rollFloat(FLOAT_TABLE, random);
      const band = FLOAT_TABLE.filter((b) => b.condition === f.condition)[0];
      expect(f.value).toBeGreaterThanOrEqual(band.min);
      expect(f.value).toBeLessThan(band.max);
      if (f.condition === 'pristine') pristine++;
    }
    expect(pristine / 50000).toBeCloseTo(0.02, 2);
  });
});
