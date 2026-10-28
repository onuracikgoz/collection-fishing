import { describe, expect, it } from 'vitest';
import { REEL_PARAMS, WATCH } from '../src/config';
import { simulateReel } from '../src/rules/reel';
import { solveReel } from '../src/debug/sim';
import {
  activity,
  emptyStats,
  ipGroups,
  normalizeStats,
  playerFlags,
  recordCast,
  recordChat,
  recordHook,
  recordReel,
  recordTransfer,
  scoreOf,
  topSpot,
} from '../src/rules/watch';

const HOUR = 3600000;
const T0 = 1_800_000_000_000;
const kinds = (s: ReturnType<typeof emptyStats>) => playerFlags(s, WATCH).map((f) => f.kind);

describe('hook reaction', () => {
  it('flags a bot that always hooks after the same time', () => {
    const s = emptyStats();
    for (let i = 0; i < 40; i++) recordHook(s, 100, WATCH);
    expect(kinds(s)).toEqual(['hook_regular', 'hook_fast']);
  });
  it('leaves a human with a normal spread alone', () => {
    const s = emptyStats();
    const human = [300, 400, 250, 500, 350, 300, 600, 400, 300, 450];
    for (let i = 0; i < 40; i++) recordHook(s, human[i % human.length], WATCH);
    expect(kinds(s)).toEqual([]);
  });
  it('waits for enough samples and keeps only the last ones', () => {
    const s = emptyStats();
    for (let i = 0; i < WATCH.hook.minSamples - 1; i++) recordHook(s, 100, WATCH);
    expect(kinds(s)).toEqual([]);
    for (let i = 0; i < 100; i++) recordHook(s, 100, WATCH);
    expect(s.hookMs.length).toBe(WATCH.samples);
  });
});

describe('reel fit', () => {
  it('the perfect solver is flagged, a quick human-like miss rate is not', () => {
    const bot = emptyStats();
    for (let seed = 1; seed <= 40; seed++) {
      const p = REEL_PARAMS.rare;
      const sol = solveReel(seed * 7919, p);
      const track = { inside: 0 };
      const r = simulateReel(seed * 7919, p, sol.inputs, track);
      recordReel(bot, track.inside, r.steps, r.caught, WATCH);
    }
    expect(kinds(bot)).toContain('reel_perfect');

    const human = emptyStats();
    for (let i = 0; i < 40; i++) recordReel(human, 900, 1000, i % 10 !== 0, WATCH);
    expect(kinds(human)).toEqual([]);
  });
  it('tracking does not change the reel result', () => {
    const p = REEL_PARAMS.epic;
    const inputs = solveReel(5, p).inputs;
    expect(simulateReel(5, p, inputs, { inside: 0 })).toEqual(simulateReel(5, p, inputs));
  });
});

describe('activity, chat and spot', () => {
  it('flags 24 hours without a break', () => {
    const s = emptyStats();
    for (let h = 0; h < 24; h++) recordCast(s, 10, 10, T0 + h * HOUR, WATCH);
    expect(activity(s).streak).toBe(24);
    expect(kinds(s)).toContain('nonstop');
  });
  it('a player who sleeps is fine, and old hours drop out', () => {
    const s = emptyStats();
    for (let d = 0; d < 10; d++) for (let h = 0; h < 14; h++) recordCast(s, 10 + h, 10, T0 + (d * 24 + h) * HOUR, WATCH);
    expect(activity(s).streak).toBe(14);
    expect(activity(s).active).toBeLessThanOrEqual(7 * 14 + 14);
    expect(kinds(s)).toEqual([]);
  });
  it('flags many casts from one tile with no chat', () => {
    const s = emptyStats();
    for (let i = 0; i < 600; i++) recordCast(s, 12.3, 40.8, T0 + Math.floor(i / 50) * 2 * HOUR, WATCH);
    expect(topSpot(s)).toEqual({ tile: '12,40', share: 1 });
    expect(kinds(s)).toEqual(['silent', 'same_spot']);
    recordChat(s);
    expect(kinds(s)).toEqual(['same_spot']);
  });
  it('keeps the spot list short', () => {
    const s = emptyStats();
    for (let i = 0; i < 500; i++) recordCast(s, i, 0, T0, WATCH);
    expect(Object.keys(s.spots).length).toBeLessThanOrEqual(WATCH.maxSpots * 2);
  });
});

describe('one-way flow', () => {
  it('flags giving everything to one account', () => {
    const mule = emptyStats();
    const main = emptyStats();
    for (let i = 0; i < 4; i++) recordTransfer(mule, 'mule', main, 'main', 500, WATCH);
    expect(kinds(mule)).toEqual(['one_way_flow']);
    expect(kinds(main)).toEqual([]);
  });
  it('a fair two-way trade partner is fine', () => {
    const a = emptyStats();
    const b = emptyStats();
    for (let i = 0; i < 4; i++) {
      recordTransfer(a, 'a', b, 'b', 500, WATCH);
      recordTransfer(b, 'b', a, 'a', 450, WATCH);
    }
    expect(kinds(a)).toEqual([]);
    expect(kinds(b)).toEqual([]);
  });
});

describe('ip groups', () => {
  const acc = (id: string, ip: string, ageMs: number, online = false) => ({
    userId: id,
    online,
    account: { createdIp: ip, createdAt: T0 - ageMs, lastIp: ip, lastAt: T0 },
  });
  it('flags many new accounts from one IP in a day, not old ones', () => {
    const list = [];
    for (let i = 0; i < 12; i++) list.push(acc('n' + i, '1.2.3.4', HOUR));
    list.push(acc('old', '1.2.3.4', 3 * 24 * HOUR));
    const r = ipGroups(list, T0, WATCH);
    expect(r.flags['n0'].map((f) => f.kind)).toEqual(['ip_accounts']);
    expect(r.flags['old']).toBeUndefined();
    expect(r.groups[0].createdToday.length).toBe(12);
  });
  it('a few accounts behind one IP (CGNAT) are only listed, not flagged', () => {
    const r = ipGroups([acc('a', '5.5.5.5', HOUR, true), acc('b', '5.5.5.5', HOUR, true)], T0, WATCH);
    expect(r.flags).toEqual({});
    expect(r.groups.length).toBe(1);
  });
  it('flags many sessions online from one IP', () => {
    const list = [];
    for (let i = 0; i < 11; i++) list.push(acc('o' + i, '9.9.9.9', 30 * 24 * HOUR, true));
    expect(ipGroups(list, T0, WATCH).flags['o3'].map((f) => f.kind)).toEqual(['ip_online']);
  });
});

describe('storage and score', () => {
  it('normalizes junk', () => {
    expect(normalizeStats(null)).toEqual(emptyStats());
    const s = normalizeStats({ hookMs: [1, 'x', 2], casts: 'many', hours: { 1: 2, 2: 'x' }, given: { u: { n: 1, value: 'x' } } });
    expect(s.hookMs).toEqual([1, 2]);
    expect(s.casts).toBe(0);
    expect(s.hours).toEqual({ 1: 2 });
    expect(s.given).toEqual({ u: { n: 1, value: 0 } });
  });
  it('adds up flag weights', () => {
    expect(scoreOf([{ kind: 'hook_regular', detail: '' }, { kind: 'silent', detail: '' }], WATCH)).toBe(WATCH.weights.hook_regular + WATCH.weights.silent);
  });
});
