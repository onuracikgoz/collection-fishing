// Cast energy is kept in the match and saved with the catch or by the periodic flush, not per cast.
import { emptyStats } from '../src/rules/watch';
import { describe, expect, it } from 'vitest';
import { ENERGY, WATER } from '../src/config';
import { LAKE_MAP } from '../src/data/lake-map';
import { Fisher, flushEnergy, handleCast } from '../src/match/fishing';
import { buildWaterMap } from '../src/rules/water';

const pier = { x: 84.5, y: 47.5 };

function setup() {
  const writes: any[] = [];
  const store = new Map<string, any>();
  const nk: any = {
    storageWrite: (w: any[]) => {
      writes.push(...w);
      for (const x of w) store.set(`${x.collection}/${x.key}/${x.userId}`, x.value);
    },
    storageRead: (reqs: any[]) => reqs.filter((r) => store.has(`${r.collection}/${r.key}/${r.userId}`)).map((r) => ({ ...r, value: store.get(`${r.collection}/${r.key}/${r.userId}`) })),
  };
  const logger: any = { error: () => undefined, warn: () => undefined };
  const ctx: any = {
    nk,
    logger,
    dispatcher: { broadcastMessage: () => undefined },
    water: buildWaterMap(LAKE_MAP, WATER),
    audience: (f: Fisher) => [f.presence],
    everyone: () => [],
  };
  const f: Fisher = {
    presence: { userId: 'u1', sessionId: 's1', username: 'u1', node: 'n' } as any,
    move: { ...pier },
    energy: ENERGY.max,
    bag: { items: 0, stacks: {} },
    watch: emptyStats(),
    book: {},
    rod: { level: 1, durability: 100 } as any,
    xp: 0,
  };
  return { nk, logger, ctx, f, writes, store };
}

describe('energy saving', () => {
  it('a cast spends energy in memory only', () => {
    const w = setup();
    handleCast(w.ctx, w.f, { x: 88.5, y: 47.5 }, 0);
    expect(w.f.fish).toBeDefined();
    expect(w.f.energy).toBe(ENERGY.max - ENERGY.castCost);
    expect(w.f.energyDirty).toBe(true);
    expect(w.writes.filter((x) => x.key === 'energy')).toEqual([]);
  });

  it('the flush saves only players with unsaved energy, once', () => {
    const w = setup();
    const other = { ...setup().f, presence: { userId: 'u2' } as any };
    handleCast(w.ctx, w.f, { x: 88.5, y: 47.5 }, 0);
    flushEnergy(w.nk, w.logger, [w.f, other]);
    expect(w.writes.map((x) => [x.key, x.userId, x.value.value, x.value.online])).toEqual([['energy', 'u1', ENERGY.max - ENERGY.castCost, true]]);
    expect(w.f.energyDirty).toBe(false);
    flushEnergy(w.nk, w.logger, [w.f, other]);
    expect(w.writes.length).toBe(1);
  });

  it('keeps the flag when the save fails, so the next flush tries again', () => {
    const w = setup();
    handleCast(w.ctx, w.f, { x: 88.5, y: 47.5 }, 0);
    flushEnergy({ storageWrite: () => { throw new Error('db down'); } } as any, w.logger, [w.f]);
    expect(w.f.energyDirty).toBe(true);
  });
});
