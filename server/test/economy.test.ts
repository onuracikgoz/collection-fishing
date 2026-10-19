import { describe, expect, it } from 'vitest';
import { ECONOMY, FLOAT_TABLE } from '../src/config';
import { Category } from '../src/rules/catch';
import { OwnedItem, conditionOf, itemPrice, parseEconomyRequest, planEconomy } from '../src/rules/economy';

const items: { [id: string]: OwnedItem } = {
  a: { instanceId: 'a', tier: 'common', float: 0.3 },
  b: { instanceId: 'b', tier: 'rare', float: 0.01 },
};
const stacks = { 'j.boot': 10, 'm.scale': 3 };
const cat = (defId: string): Category | null => (defId.startsWith('j.') ? 'junk' : defId.startsWith('m.') ? 'material' : null);
const plan = (action: 'sell' | 'salvage', body: unknown) =>
  planEconomy(action, parseEconomyRequest(body)!, items, stacks, cat, FLOAT_TABLE, ECONOMY);

describe('prices', () => {
  it('maps Float to condition at band edges', () => {
    expect(conditionOf(0, FLOAT_TABLE)).toBe('pristine');
    expect(conditionOf(0.05, FLOAT_TABLE)).toBe('excellent');
    expect(conditionOf(0.9999, FLOAT_TABLE)).toBe('damaged');
  });

  it('multiplies the Tier price by condition and never goes below 1', () => {
    expect(itemPrice(items.a, FLOAT_TABLE, ECONOMY)).toBe(5);
    expect(itemPrice(items.b, FLOAT_TABLE, ECONOMY)).toBe(75);
    const cfg = { ...ECONOMY, sellPrice: { ...ECONOMY.sellPrice, common: 1 } };
    expect(itemPrice({ instanceId: 'x', tier: 'common', float: 0.9 }, FLOAT_TABLE, cfg)).toBe(1);
  });
});

describe('planEconomy', () => {
  it('sells items and part of a stack', () => {
    const r = plan('sell', { items: ['a', 'b'], stacks: [{ defId: 'j.boot', count: 4 }] });
    expect(r).toEqual({
      ok: true,
      gained: 5 + 75 + 4,
      removeItems: ['a', 'b'],
      stacksAfter: { 'j.boot': 6 },
      removedStacks: [{ defId: 'j.boot', count: 4 }],
    });
  });

  it('salvages for dust, ignoring Float', () => {
    const r = plan('salvage', { items: ['b'], stacks: [{ defId: 'm.scale', count: 3 }] });
    expect(r.ok && r.gained).toBe(25 + 3 * 2);
    expect(r.ok && r.stacksAfter).toEqual({ 'm.scale': 0 });
  });

  it('adds up repeated stack lines before checking the count', () => {
    expect(plan('sell', { stacks: [{ defId: 'm.scale', count: 2 }, { defId: 'm.scale', count: 2 }] })).toEqual({ ok: false, reason: 'NOT_ENOUGH' });
  });

  it('refuses what the player does not own', () => {
    expect(plan('sell', { items: ['zz'] })).toEqual({ ok: false, reason: 'NOT_OWNED' });
    expect(plan('sell', { stacks: [{ defId: 'j.can', count: 1 }] })).toEqual({ ok: false, reason: 'NOT_OWNED' });
    expect(plan('sell', { items: ['a', 'a'] })).toEqual({ ok: false, reason: 'BAD_REQUEST' });
    expect(plan('sell', {})).toEqual({ ok: false, reason: 'BAD_REQUEST' });
  });

  it('refuses salvage of what cannot be salvaged', () => {
    const cfg = { ...ECONOMY, dust: { ...ECONOMY.dust, rare: null } };
    const r = planEconomy('salvage', { items: ['b'], stacks: [] }, items, stacks, cat, FLOAT_TABLE, cfg);
    expect(r).toEqual({ ok: false, reason: 'CANNOT_SALVAGE' });
  });

  it('limits the request size', () => {
    const many = Array.from({ length: ECONOMY.maxEntries + 1 }, (_, i) => 'i' + i);
    expect(plan('sell', { items: many })).toEqual({ ok: false, reason: 'TOO_MANY' });
  });
});

describe('parseEconomyRequest', () => {
  it('rejects malformed bodies', () => {
    expect(parseEconomyRequest(null)).toBe(null);
    expect(parseEconomyRequest({ items: 'a' })).toBe(null);
    expect(parseEconomyRequest({ stacks: [{ defId: 'x', count: 0 }] })).toBe(null);
    expect(parseEconomyRequest({ stacks: [{ defId: 'x', count: 1.5 }] })).toBe(null);
    expect(parseEconomyRequest({ items: [''] })).toBe(null);
  });
});
