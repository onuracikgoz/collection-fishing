// Cast energy and fishing time are kept in the match and saved with the catch or by the periodic flush;
// bot signals (hook reaction times, very long days) raise a flag for moderators.
import { describe, expect, it } from 'vitest';
import { ENERGY, WATER } from '../src/config';
import { LAKE_MAP } from '../src/data/lake-map';
import { Fisher, flushPlayers, handleCast, handleHook, newBotState, tickFishing } from '../src/match/fishing';
import { BOT_CHECK } from '../src/config';
import { addActive, dayNumber, hookTooRegular, pushSample, stdev, tooLong } from '../src/rules/botCheck';
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
    flushPlayers(w.nk, w.logger, [w.f, other]);
    expect(w.writes.map((x) => [x.key, x.userId, x.value.value, x.value.online])).toEqual([['energy', 'u1', ENERGY.max - ENERGY.castCost, true]]);
    expect(w.f.energyDirty).toBe(false);
    flushPlayers(w.nk, w.logger, [w.f, other]);
    expect(w.writes.length).toBe(1);
  });

  it('keeps the flag when the save fails, so the next flush tries again', () => {
    const w = setup();
    handleCast(w.ctx, w.f, { x: 88.5, y: 47.5 }, 0);
    flushPlayers({ storageWrite: () => { throw new Error('db down'); } } as any, w.logger, [w.f]);
    expect(w.f.energyDirty).toBe(true);
  });
});

describe('bot signals: rules', () => {
  it('keeps the newest samples and measures their spread', () => {
    let xs: number[] = [];
    for (let i = 0; i < 5; i++) xs = pushSample(xs, i, 3);
    expect(xs).toEqual([2, 3, 4]);
    expect(stdev([300, 300, 300])).toBe(0);
    expect(stdev([200, 400])).toBe(100);
  });

  it('flags only a full and very even set of hook times', () => {
    const even = Array(BOT_CHECK.hookSamples).fill(300);
    expect(hookTooRegular(even, BOT_CHECK)).toBe(true);
    expect(hookTooRegular(even.slice(1), BOT_CHECK)).toBe(false);
    const human = even.map((_, i) => [200, 300, 300, 400, 500][i % 5]);
    expect(hookTooRegular(human, BOT_CHECK)).toBe(false);
  });

  it('counts fishing time between casts within the gap, per day', () => {
    const day0 = 1_000 * 86400000 - BOT_CHECK.dayOffsetMs; // 00:00 Turkey time
    let doc = addActive(null, undefined, day0 + 1000, BOT_CHECK);
    expect(doc).toEqual({ day: dayNumber(day0, BOT_CHECK), ms: 0 });
    doc = addActive(doc, day0 + 1000, day0 + 31000, BOT_CHECK);
    expect(doc.ms).toBe(30000);
    // A long break does not count.
    doc = addActive(doc, day0 + 31000, day0 + 31000 + BOT_CHECK.activeGapMs + 1, BOT_CHECK);
    expect(doc.ms).toBe(30000);
    // The next day starts over.
    expect(addActive(doc, day0 + 86400000 - 1000, day0 + 86400000 + 1000, BOT_CHECK)).toEqual({ day: doc.day + 1, ms: 2000 });
    expect(tooLong({ day: 1, ms: BOT_CHECK.maxDailyActiveMs + 1 }, BOT_CHECK)).toBe(true);
  });
});

describe('bot signals: in the match', () => {
  const fishOnce = (w: ReturnType<typeof setup>, t: number, reaction: number) => {
    w.f.fish = undefined;
    w.f.energy = ENERGY.max;
    handleCast(w.ctx, w.f, { x: 88.5, y: 47.5 }, t);
    const biteAt = w.f.fish!.biteAt;
    // Twitches first, then the bite at its tick.
    tickFishing(w.ctx, w.f, biteAt);
    if (w.f.fish?.phase !== 'bite') return false;
    handleHook(w.ctx, w.f, biteAt + reaction);
    return true;
  };

  it('a player who always hooks after exactly the same time gets flagged once', () => {
    const w = setup();
    w.f.bot = newBotState(null);
    let t = 0;
    let hooks = 0;
    while (hooks < BOT_CHECK.hookSamples + 5) {
      if (fishOnce(w, t, 300)) hooks++;
      t += 60000;
    }
    const flag = w.store.get('bot_flags/u1/00000000-0000-0000-0000-000000000000');
    expect(flag.flags.regular_hook).toMatchObject({ days: 1 });
    expect(flag.flags.regular_hook.detail.stdevMs).toBe(0);
    expect(w.writes.filter((x) => x.collection === 'bot_flags').length).toBe(1);
  });

  it('uneven reaction times raise nothing, and the fishing time is saved by the flush', () => {
    const w = setup();
    w.f.bot = newBotState(null);
    let t = 0;
    let hooks = 0;
    while (hooks < BOT_CHECK.hookSamples + 5) {
      if (fishOnce(w, t, [200, 300, 300, 400, 600][hooks % 5])) hooks++;
      t += 60000;
    }
    expect(w.store.has('bot_flags/u1/00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(w.f.bot!.activityDirty).toBe(true);
    flushPlayers(w.nk, w.logger, [w.f]);
    expect(w.store.get('player/activity/u1')).toEqual(w.f.bot!.activity);
    expect(w.f.bot!.activityDirty).toBe(false);
  });
});
