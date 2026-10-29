// Pet stall rules: spots, listing checks, fee, buying (docs/protokol.md, Pazar).
import { describe, expect, it } from 'vitest';
import { MARKET } from '../src/config';
import { Listing, buildSpots, feeOf, nearestFreeSpot, parseBuy, parseListing, planBuy, topEntries } from '../src/rules/market';

const cfg = MARKET;
const listing: Listing = {
  title: 'Fresh fish',
  items: [{ instanceId: 'i1', price: 100 }, { instanceId: 'i2', price: 250 }],
  stacks: [{ defId: 'worm', count: 10, price: 3 }],
};

describe('spots', () => {
  it('lays a grid around the market point and skips blocked tiles', () => {
    const all = buildSpots({ x: 60.5, y: 24.5 }, cfg, () => true);
    expect(all.length).toBe(cfg.columns * cfg.rows);
    expect(all[0]).toEqual({ id: 0, x: 60.5 - ((cfg.columns - 1) * cfg.spacing) / 2, y: 24.5 - ((cfg.rows - 1) * cfg.spacing) / 2 });
    const some = buildSpots({ x: 60.5, y: 24.5 }, cfg, (x) => x > 60);
    expect(some.length).toBeLessThan(all.length);
    expect(some.every((s) => s.x > 60)).toBe(true);
  });

  it('gives the free spot nearest the player', () => {
    const spots = buildSpots({ x: 60.5, y: 24.5 }, cfg, () => true);
    const first = nearestFreeSpot(spots, {}, spots[0].x, spots[0].y);
    expect(first && first.id).toBe(0);
    const next = nearestFreeSpot(spots, { 0: true }, spots[0].x, spots[0].y);
    expect(next && next.id).not.toBe(0);
    const taken: { [id: number]: true } = {};
    for (const s of spots) taken[s.id] = true;
    expect(nearestFreeSpot(spots, taken, 0, 0)).toBeNull();
  });
});

describe('parseListing', () => {
  const ok = { title: ' Fresh   fish ', items: [{ instanceId: 'a', price: 5 }], stacks: [{ defId: 'worm', count: 4, price: 2 }] };

  it('accepts a good listing and cleans the title', () => {
    const r = parseListing(ok, cfg);
    expect(r).toEqual({ ok: true, listing: { title: 'Fresh fish', items: [{ instanceId: 'a', price: 5 }], stacks: [{ defId: 'worm', count: 4, price: 2 }] } });
  });

  it('allows an empty title and cuts a long one', () => {
    const empty = parseListing({ ...ok, title: '' }, cfg);
    expect(empty.ok && empty.listing.title).toBe('');
    const none = parseListing({ items: ok.items }, cfg);
    expect(none.ok && none.listing.title).toBe('');
    const long = parseListing({ ...ok, title: 'x'.repeat(100) }, cfg);
    expect(long.ok && long.listing.title.length).toBe(cfg.titleMax);
  });

  it('rejects bad shapes', () => {
    for (const body of [null, 5, {}, { items: 'x' }, { items: [], stacks: [] }, { ...ok, title: 5 }, { items: [{ instanceId: '', price: 1 }] }, { items: [{ price: 1 }] }]) {
      const r = parseListing(body, cfg);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('BAD_REQUEST');
    }
    const dup = parseListing({ items: [{ instanceId: 'a', price: 1 }, { instanceId: 'a', price: 2 }] }, cfg);
    expect(dup.ok).toBe(false);
    const dupStack = parseListing({ stacks: [{ defId: 'w', count: 1, price: 1 }, { defId: 'w', count: 1, price: 1 }] }, cfg);
    expect(dupStack.ok).toBe(false);
    expect(parseListing({ stacks: [{ defId: 'w', count: 0, price: 1 }] }, cfg).ok).toBe(false);
  });

  it('checks prices', () => {
    for (const price of [0, -1, 1.5, '5', cfg.maxPrice + 1]) {
      const r = parseListing({ items: [{ instanceId: 'a', price }] }, cfg);
      expect(r).toEqual({ ok: false, reason: 'BAD_PRICE' });
    }
    expect(parseListing({ items: [{ instanceId: 'a', price: cfg.maxPrice }] }, cfg).ok).toBe(true);
    // A stack's total counts too.
    expect(parseListing({ stacks: [{ defId: 'w', count: 1000, price: cfg.maxPrice }] }, cfg)).toEqual({ ok: false, reason: 'BAD_PRICE' });
  });

  it('caps the number of entries', () => {
    const items = Array.from({ length: cfg.maxEntries }, (_, i) => ({ instanceId: `i${i}`, price: 1 }));
    expect(parseListing({ items }, cfg).ok).toBe(true);
    expect(parseListing({ items, stacks: [{ defId: 'w', count: 1, price: 1 }] }, cfg)).toEqual({ ok: false, reason: 'TOO_MANY' });
  });
});

describe('feeOf', () => {
  it('takes 5 percent rounded up, but never the whole sale', () => {
    expect(feeOf(100, cfg)).toBe(5);
    expect(feeOf(101, cfg)).toBe(6);
    expect(feeOf(10, cfg)).toBe(1);
    expect(feeOf(2, cfg)).toBe(1);
    expect(feeOf(1, cfg)).toBe(0);
  });
});

describe('parseBuy and planBuy', () => {
  it('reads an item buy and a stack buy, also with Unity-style empty fields', () => {
    expect(parseBuy({ userId: 'o', instanceId: 'i1' })).toEqual({ owner: 'o', instanceId: 'i1' });
    expect(parseBuy({ userId: 'o', instanceId: 'i1', defId: '', count: 0 })).toEqual({ owner: 'o', instanceId: 'i1' });
    expect(parseBuy({ userId: 'o', instanceId: '', defId: 'worm', count: 3 })).toEqual({ owner: 'o', defId: 'worm', count: 3 });
    for (const body of [null, {}, { userId: 'o' }, { userId: 'o', defId: 'worm' }, { userId: 'o', defId: 'worm', count: 0 }, { userId: 'o', defId: 'worm', count: 1.5 }, { instanceId: 'i1' }]) {
      expect(parseBuy(body)).toBeNull();
    }
  });

  it('plans an item buy without touching the listing', () => {
    const plan = planBuy(listing, { owner: 'o', instanceId: 'i2' });
    expect(plan).toMatchObject({ ok: true, kind: 'item', instanceId: 'i2', total: 250 });
    if (plan.ok) expect(plan.rest.items.map((i) => i.instanceId)).toEqual(['i1']);
    expect(listing.items.length).toBe(2);
    expect(planBuy(listing, { owner: 'o', instanceId: 'nope' })).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('plans a stack buy: part of it, then all of it', () => {
    const part = planBuy(listing, { owner: 'o', defId: 'worm', count: 4 });
    expect(part).toMatchObject({ ok: true, kind: 'stack', total: 12 });
    if (part.ok) expect(part.rest.stacks).toEqual([{ defId: 'worm', count: 6, price: 3 }]);
    const all = planBuy(listing, { owner: 'o', defId: 'worm', count: 10 });
    expect(all).toMatchObject({ ok: true, total: 30 });
    if (all.ok) expect(all.rest.stacks).toEqual([]);
    expect(planBuy(listing, { owner: 'o', defId: 'worm', count: 11 })).toEqual({ ok: false, reason: 'NOT_ENOUGH' });
    expect(planBuy(listing, { owner: 'o', defId: 'gold', count: 1 })).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});

describe('topEntries', () => {
  it('shows Float items first, then stacks, up to n', () => {
    const info = { i1: { defId: 'carp', tier: 'rare' }, i2: { defId: 'pike', tier: 'epic' } };
    expect(topEntries(listing, info, 4)).toEqual([
      { defId: 'carp', tier: 'rare', count: 1, price: 100 },
      { defId: 'pike', tier: 'epic', count: 1, price: 250 },
      { defId: 'worm', tier: '', count: 10, price: 3 },
    ]);
    expect(topEntries(listing, info, 2).length).toBe(2);
  });
});
