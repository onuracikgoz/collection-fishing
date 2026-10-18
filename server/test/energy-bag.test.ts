import { describe, expect, it } from 'vitest';
import { BAG, ENERGY } from '../src/config';
import { canAdd, hasFreeSlot, slotsUsed } from '../src/rules/bag';
import { regenOffline, spendCast } from '../src/rules/energy';

describe('energy', () => {
  it('refills fully in 8 hours offline and caps at max', () => {
    expect(regenOffline(0, 4 * 3600 * 1000, ENERGY)).toBe(50);
    expect(regenOffline(90, 8 * 3600 * 1000, ENERGY)).toBe(100);
    expect(regenOffline(30, -5, ENERGY)).toBe(30);
  });
  it('charges a cast, or lets you cast free for junk at zero', () => {
    expect(spendCast(10, ENERGY)).toEqual({ value: 9, hasEnergy: true });
    expect(spendCast(0, ENERGY)).toEqual({ value: 0, hasEnergy: false });
    expect(spendCast(0.5, ENERGY)).toEqual({ value: 0.5, hasEnergy: false });
  });
});

describe('bag', () => {
  it('counts one slot per item and per 99 stacked', () => {
    expect(slotsUsed({ items: 3, stacks: { a: 1, b: 99, c: 100 } }, BAG)).toBe(3 + 1 + 1 + 2);
  });
  it('fits into a partial stack even when slots are full', () => {
    const full = { items: 39, stacks: { a: 5 } };
    expect(hasFreeSlot(full, BAG)).toBe(false);
    expect(canAdd(full, 'a', BAG)).toBe(true);
    expect(canAdd(full, 'b', BAG)).toBe(false);
    expect(canAdd(full, null, BAG)).toBe(false);
  });
});
