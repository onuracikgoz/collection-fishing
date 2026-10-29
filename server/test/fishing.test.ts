import { describe, expect, it } from 'vitest';
import { BAG, FISHING, WATER } from '../src/config';
import { LAKE_MAP } from '../src/data/lake-map';
import { REEL_PARAMS } from '../src/config';
import { FishState, checkCast, judgeReel, onHook, parseCast, planWait, reelParamsFor, reelTimedOut } from '../src/rules/fishing';
import { Band } from '../src/rules/water';
import { seededRandom } from '../src/rules/rng';
import { buildWaterMap } from '../src/rules/water';

const lake = buildWaterMap(LAKE_MAP, WATER);
const pier = { x: 84.5, y: 47.5 };
const empty = { items: 0, stacks: {} };

describe('checkCast', () => {
  it('accepts a cast from the pier into the lake', () => {
    expect(checkCast(lake, pier, { x: 88.5, y: 47.5 }, false, empty, BAG, FISHING)).toEqual({ ok: true, band: 'mid', water: 'buyuk_gol' });
  });
  it('explains each refusal', () => {
    expect(checkCast(lake, pier, { x: 88, y: 47 }, true, empty, BAG, FISHING)).toEqual({ ok: false, reason: 'BUSY' });
    expect(checkCast(lake, LAKE_MAP.spawn, { x: 88, y: 47 }, false, empty, BAG, FISHING)).toEqual({ ok: false, reason: 'NOT_NEAR_WATER' });
    expect(checkCast(lake, pier, { x: 80, y: 47.5 }, false, empty, BAG, FISHING)).toEqual({ ok: false, reason: 'NOT_WATER' });
    expect(checkCast(lake, pier, { x: 100, y: 47.5 }, false, empty, BAG, FISHING)).toEqual({ ok: false, reason: 'TOO_FAR' });
    expect(checkCast(lake, pier, { x: 88, y: 47 }, false, { items: 40, stacks: {} }, BAG, FISHING)).toEqual({ ok: false, reason: 'BAG_FULL' });
  });
  it('parses only numeric targets', () => {
    expect(parseCast({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(parseCast({ x: '1', y: 2 })).toBeNull();
    expect(parseCast({ x: NaN, y: 2 })).toBeNull();
  });
});

describe('planWait', () => {
  it('waits per band, with twitches strictly before the bite', () => {
    const random = seededRandom(9);
    for (let i = 0; i < 3000; i++) {
      const band = (['shore', 'mid', 'deep'] as Band[])[i % 3];
      const w = planWait(1000, band, FISHING, random);
      expect(w.biteAt - 1000).toBeGreaterThanOrEqual(FISHING.wait[band].minMs);
      expect(w.biteAt - 1000).toBeLessThanOrEqual(FISHING.wait[band].maxMs);
      expect(w.twitches.length).toBeLessThanOrEqual(3);
      for (const t of w.twitches) {
        expect(t).toBeGreaterThanOrEqual(2000);
        expect(t).toBeLessThan(w.biteAt - 1000);
      }
    }
  });
});

describe('band balance: tempo', () => {
  it('the shore bites sooner than deep water', () => {
    const avg = (band: Band) => {
      const random = seededRandom(4);
      let sum = 0;
      for (let i = 0; i < 2000; i++) sum += planWait(0, band, FISHING, random).biteAt;
      return sum / 2000;
    };
    expect(avg('shore')).toBeLessThan(avg('mid'));
    expect(avg('mid')).toBeLessThan(avg('deep'));
  });

  it('deep fish are harder to reel, shore fish easier, integers kept', () => {
    const p = REEL_PARAMS.rare;
    const shore = reelParamsFor(p, 'shore', FISHING);
    const deep = reelParamsFor(p, 'deep', FISHING);
    expect(shore.barSize).toBeGreaterThan(p.barSize);
    expect(deep.barSize).toBeLessThan(p.barSize);
    expect(deep.fishSpeed).toBeGreaterThan(p.fishSpeed);
    expect(reelParamsFor(p, 'mid', FISHING)).toEqual(p);
    for (const v of Object.values(deep)) expect(Number.isInteger(v)).toBe(true);
  });
});

const base: FishState = { phase: 'waiting', x: 0, y: 0, band: 'shore', hasEnergy: true, biteAt: 5000, twitches: [], hookDeadline: 0 };

describe('onHook', () => {
  it('misses when pulled before the bite or after the window', () => {
    expect(onHook(base, 3000)).toBe('missed');
    expect(onHook({ ...base, phase: 'bite', hookDeadline: 5900 }, 5800)).toBe('reel');
    expect(onHook({ ...base, phase: 'bite', hookDeadline: 5900 }, 6000)).toBe('missed');
    expect(onHook({ ...base, phase: 'reeling' }, 6000)).toBe('ignore');
  });
});

describe('judgeReel', () => {
  const reeling = { ...base, phase: 'reeling' as const, reelStartAt: 10000, params: { maxMs: 30000 } as never };
  it('trusts the replay when the report comes on time', () => {
    expect(judgeReel(reeling, { caught: true, steps: 100 }, 12000, FISHING)).toBe('caught');
    expect(judgeReel(reeling, { caught: false, steps: 100 }, 12000, FISHING)).toBe('escaped');
  });
  it('treats a report faster than the game as escaped', () => {
    expect(judgeReel(reeling, { caught: true, steps: 400 }, 12000, FISHING)).toBe('escaped');
  });
  it('times out an unfinished reel', () => {
    expect(reelTimedOut(reeling, 10000 + 30000 + 4000, FISHING)).toBe(false);
    expect(reelTimedOut(reeling, 10000 + 30000 + 6000, FISHING)).toBe(true);
  });
});
