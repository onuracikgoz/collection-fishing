import { describe, expect, it } from 'vitest';
import { TRADE, XP } from '../src/config';
import { addXp, levelOf, normalizeXp, totalForLevel, xpForCatch, xpToNext } from '../src/rules/xp';

describe('level curve', () => {
  it('starts at level 1 and needs a bit more XP each level', () => {
    expect(levelOf(0, XP)).toEqual({ level: 1, xp: 0, xpNext: xpToNext(1, XP) });
    expect(xpToNext(2, XP)).toBeGreaterThan(xpToNext(1, XP));
  });
  it('moves up exactly at the threshold', () => {
    const need = xpToNext(1, XP);
    expect(levelOf(need - 1, XP).level).toBe(1);
    expect(levelOf(need, XP)).toEqual({ level: 2, xp: 0, xpNext: xpToNext(2, XP) });
    expect(levelOf(need + 5, XP).xp).toBe(5);
  });
  it('totalForLevel and levelOf agree', () => {
    for (const l of [1, 2, 7, 10, 25, XP.maxLevel]) {
      expect(levelOf(totalForLevel(l, XP), XP).level).toBe(l);
      if (l > 1) expect(levelOf(totalForLevel(l, XP) - 1, XP).level).toBe(l - 1);
    }
  });
  it('stops at the top level', () => {
    const top = totalForLevel(XP.maxLevel, XP);
    expect(levelOf(top + 1_000_000, XP)).toMatchObject({ level: XP.maxLevel, xpNext: 0 });
  });
  it('makes the trade level a real climb, not a few casts', () => {
    expect(totalForLevel(TRADE.minLevel, XP)).toBeGreaterThan(1000);
  });
});

describe('xp per catch', () => {
  it('rewards rarity, and gives nothing without energy', () => {
    expect(xpForCatch('mythic', true, XP)).toBeGreaterThan(xpForCatch('rare', true, XP));
    expect(xpForCatch('rare', true, XP)).toBeGreaterThan(xpForCatch('junk', true, XP));
    expect(xpForCatch('junk', true, XP)).toBeGreaterThan(0);
    expect(xpForCatch('mythic', false, XP)).toBe(0);
  });
  it('reports a level up with what it opens', () => {
    const before = totalForLevel(TRADE.minLevel, XP) - 1;
    const r = addXp(before, 5, XP);
    expect(r.total).toBe(before + 5);
    expect(r.gain.levelUp).toEqual({ level: TRADE.minLevel, unlocks: ['trade'] });
    expect(addXp(0, 1, XP).gain.levelUp).toBeUndefined();
  });
  it('collects the unlocks of every level crossed at once', () => {
    const r = addXp(0, totalForLevel(12, XP), XP);
    expect(r.gain.levelUp).toEqual({ level: 12, unlocks: ['trade'] });
  });
});

describe('stored xp', () => {
  it('reads the stored total and ignores junk', () => {
    expect(normalizeXp({ total: 120.7 })).toBe(120);
    expect(normalizeXp({ total: -5 })).toBe(0);
    expect(normalizeXp({ total: 'x' })).toBe(0);
    expect(normalizeXp(null)).toBe(0);
  });
});
