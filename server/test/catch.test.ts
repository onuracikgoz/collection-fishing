import { describe, expect, it } from 'vitest';
import { CATCH_TABLE, FLOAT_TABLE } from '../src/config';
import { LAKE_POOL } from '../src/data/lake-pool';
import { ItemDef, rollCatch, rollFloat } from '../src/rules/catch';
import { seededRandom } from '../src/rules/rng';

describe('rollCatch', () => {
  it('follows the catch table over many casts', () => {
    const random = seededRandom(1);
    const counts: { [k: string]: number } = {};
    const n = 200000;
    for (let i = 0; i < n; i++) {
      const r = rollCatch(LAKE_POOL, CATCH_TABLE, 'deep', true, random)!;
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
    for (let i = 0; i < 1000; i++) expect(rollCatch(LAKE_POOL, CATCH_TABLE, 'deep', false, random)!.def.category).toBe('junk');
  });

  it('never gives an item outside its bands, falling back to junk', () => {
    const random = seededRandom(3);
    for (let i = 0; i < 20000; i++) {
      const r = rollCatch(LAKE_POOL, CATCH_TABLE, 'shore', true, random)!;
      expect(!r.def.bands || r.def.bands.indexOf('shore') >= 0).toBe(true);
    }
  });

  it('sets a tier only for Float items', () => {
    const pool: ItemDef[] = [{ id: 'j', category: 'junk' }, { id: 'r', category: 'rare' }];
    expect(rollCatch(pool, { junk: 1 }, 'shore', true, () => 0)!.tier).toBeNull();
    expect(rollCatch(pool, { rare: 1 }, 'shore', true, () => 0)!.tier).toBe('rare');
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
