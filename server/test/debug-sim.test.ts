import { describe, expect, it } from 'vitest';
import { BOOK_LUCK, CATCH_TABLE, FLOAT_TABLE, REEL_PARAMS } from '../src/config';
import { LAKE_POOL } from '../src/data/lake-pool';
import { mapRows, simulateCatches, solveReel } from '../src/debug/sim';
import { simulateReel } from '../src/rules/reel';
import { seededRandom } from '../src/rules/rng';

describe('dev dashboard: solveReel', () => {
  const tiers = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;
  it('finds inputs the server replay accepts as caught, for every tier', () => {
    for (const tier of tiers) {
      for (let seed = 1; seed <= 30; seed++) {
        const sol = solveReel(seed * 7919, REEL_PARAMS[tier]);
        const replay = simulateReel(seed * 7919, REEL_PARAMS[tier], sol.inputs);
        expect(replay).toEqual({ caught: sol.caught, steps: sol.steps });
        expect(sol.caught).toBe(true);
      }
    }
  });
  it('inputs are increasing integers inside maxMs', () => {
    const sol = solveReel(42, REEL_PARAMS.mythic);
    for (let i = 1; i < sol.inputs.length; i++) expect(sol.inputs[i]).toBeGreaterThan(sol.inputs[i - 1]);
    expect(sol.inputs.every((t) => Number.isInteger(t) && t <= REEL_PARAMS.mythic.maxMs)).toBe(true);
  });
  it('lose mode lets the fish escape', () => {
    for (let seed = 1; seed <= 20; seed++) expect(solveReel(seed, REEL_PARAMS.common, true).caught).toBe(false);
  });
});

describe('dev dashboard: simulateCatches', () => {
  it('without energy only junk comes up', () => {
    const r = simulateCatches(LAKE_POOL, CATCH_TABLE, 'deep', false, 0, BOOK_LUCK, FLOAT_TABLE, 500, seededRandom(1));
    expect(Object.keys(r.byCategory)).toEqual(['junk']);
    expect(r.byCategory.junk).toBe(500);
  });
  it('shore never gives deep-only items and counts add up', () => {
    const r = simulateCatches(LAKE_POOL, CATCH_TABLE, 'shore', true, 0, BOOK_LUCK, FLOAT_TABLE, 5000, seededRandom(2));
    expect(r.byDef['lake.fish.golden_carp']).toBeUndefined();
    const total = Object.values(r.byCategory).reduce((a, b) => a + b, 0);
    expect(total + r.empty).toBe(5000);
  });
});

describe('dev dashboard: mapRows', () => {
  it('marks land, blocked and water bands', () => {
    const rows = mapRows(3, 1, (x) => x > 1 && x < 2, (x) => (x > 2 ? 'deep' : null));
    expect(rows).toEqual(['.#d']);
  });
});
