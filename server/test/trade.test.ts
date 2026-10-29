import { describe, expect, it } from 'vitest';
import { BAG, TRADE } from '../src/config';
import { EMPTY_OFFER, Holdings, Offer, accept, confirm, confirmInMs, newSession, otherOf, parseOffer, planTrade, setLock, setOffer, slots } from '../src/rules/trade';

const offer = (items: string[] = [], stacks: { defId: string; count: number }[] = [], coin = 0): Offer => ({ items, stacks, coin });

describe('parseOffer', () => {
  it('reads a good offer and defaults the missing fields', () => {
    expect(parseOffer({ items: ['a', 'b'], stacks: [{ defId: 'x', count: 3 }], coin: 50 })).toEqual(offer(['a', 'b'], [{ defId: 'x', count: 3 }], 50));
    expect(parseOffer({})).toEqual(EMPTY_OFFER);
  });
  it('rejects bad shapes, duplicates, bad counts and coin', () => {
    expect(parseOffer(null)).toBeNull();
    expect(parseOffer({ items: 'a' })).toBeNull();
    expect(parseOffer({ items: ['a', 'a'] })).toBeNull();
    expect(parseOffer({ items: [1] })).toBeNull();
    expect(parseOffer({ stacks: [{ defId: 'x', count: 0 }] })).toBeNull();
    expect(parseOffer({ stacks: [{ defId: 'x', count: 1.5 }] })).toBeNull();
    expect(parseOffer({ stacks: [{ defId: 'x', count: 1 }, { defId: 'x', count: 2 }] })).toBeNull();
    expect(parseOffer({ coin: -1 })).toBeNull();
    expect(parseOffer({ coin: 1.5 })).toBeNull();
    expect(parseOffer({ coin: 'many' })).toBeNull();
  });
  it('counts items and stacks together as slots', () => {
    expect(slots(offer(['a', 'b'], [{ defId: 'x', count: 3 }]))).toBe(3);
  });
});

describe('session', () => {
  const open = () => {
    const s = newSession('t1', 'A', 'B', 0, TRADE);
    accept(s, 1000, TRADE);
    return s;
  };
  it('starts as an invite that expires, and opens on accept', () => {
    const s = newSession('t1', 'A', 'B', 100, TRADE);
    expect(s.phase).toBe('invite');
    expect(s.expiresAt).toBe(100 + TRADE.inviteMs);
    accept(s, 500, TRADE);
    expect(s.phase).toBe('open');
    expect(s.expiresAt).toBe(500 + TRADE.openTimeoutMs);
    expect(otherOf(s, 'A')).toBe('B');
    expect(otherOf(s, 'B')).toBe('A');
  });
  it('needs both locks, then the countdown, then both confirms', () => {
    const s = open();
    setLock(s, 'A', true, 2000);
    expect(confirmInMs(s, 2000, TRADE)).toBeNull();
    setLock(s, 'B', true, 2500);
    expect(confirmInMs(s, 2500, TRADE)).toBe(TRADE.countdownMs);
    expect(confirm(s, 'A', 3000, TRADE)).toBe('ignored');
    expect(confirmInMs(s, 4000, TRADE)).toBe(1500);
    expect(confirm(s, 'A', 2500 + TRADE.countdownMs, TRADE)).toBe('waiting');
    expect(confirm(s, 'B', 2500 + TRADE.countdownMs, TRADE)).toBe('ready');
  });
  it('opens both locks and drops confirmations when either side changes its offer', () => {
    const s = open();
    setLock(s, 'A', true, 2000);
    setLock(s, 'B', true, 2000);
    confirm(s, 'A', 2000 + TRADE.countdownMs, TRADE);
    setOffer(s, 'B', offer(['i1']));
    expect(s.locked).toEqual({ A: false, B: false });
    expect(s.confirmed).toEqual({ A: false, B: false });
    expect(confirmInMs(s, 9000, TRADE)).toBeNull();
    expect(confirm(s, 'A', 9000, TRADE)).toBe('ignored');
  });
  it('unlocking opens both locks', () => {
    const s = open();
    setLock(s, 'A', true, 1);
    setLock(s, 'B', true, 1);
    setLock(s, 'A', false, 2);
    expect(s.locked).toEqual({ A: false, B: false });
    expect(s.lockedAt).toBeNull();
  });
  it('locking twice does not restart the countdown', () => {
    const s = open();
    setLock(s, 'A', true, 1000);
    setLock(s, 'B', true, 2000);
    setLock(s, 'B', true, 2900);
    expect(s.lockedAt).toBe(2000);
  });
});

describe('planTrade', () => {
  const holdings = (userId: string, o: Partial<Holdings> = {}): Holdings => ({ userId, items: {}, stacks: {}, coin: 0, bag: { items: 0, stacks: {} }, ...o });
  it('swaps items, stacks and coin', () => {
    const a = holdings('A', { items: { i1: true }, stacks: { shell: 5 }, coin: 100, bag: { items: 1, stacks: { shell: 5 } } });
    const b = holdings('B', { items: { i2: true, i3: true }, coin: 20, bag: { items: 2, stacks: {} } });
    const plan = planTrade(a, offer(['i1'], [{ defId: 'shell', count: 2 }], 30), b, offer(['i2', 'i3']), BAG);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.a.coinDelta).toBe(-30);
    expect(plan.b.coinDelta).toBe(30);
    expect(plan.a.itemsAfter).toBe(2);
    expect(plan.b.itemsAfter).toBe(1);
    expect(plan.a.stacksAfter).toEqual({ shell: 3 });
    expect(plan.b.stacksAfter).toEqual({ shell: 2 });
    expect(plan.a.getItems).toEqual(['i2', 'i3']);
  });
  it('drops a stack that is traded away completely', () => {
    const a = holdings('A', { stacks: { shell: 2 }, bag: { items: 0, stacks: { shell: 2 } } });
    const plan = planTrade(a, offer([], [{ defId: 'shell', count: 2 }]), holdings('B'), EMPTY_OFFER, BAG);
    expect(plan.ok && plan.a.stacksAfter).toEqual({});
  });
  it('refuses an item that left the bag, with whose it is', () => {
    const plan = planTrade(holdings('A'), offer(['gone']), holdings('B'), EMPTY_OFFER, BAG);
    expect(plan).toEqual({ ok: false, reason: 'ITEM_GONE', userId: 'A' });
  });
  it('refuses more stack or coin than owned', () => {
    const b = holdings('B', { stacks: { shell: 1 }, bag: { items: 0, stacks: { shell: 1 } } });
    expect(planTrade(holdings('A'), EMPTY_OFFER, b, offer([], [{ defId: 'shell', count: 2 }]), BAG)).toEqual({ ok: false, reason: 'NOT_ENOUGH', userId: 'B' });
    expect(planTrade(holdings('A', { coin: 5 }), offer([], [], 6), holdings('B'), EMPTY_OFFER, BAG)).toEqual({ ok: false, reason: 'NOT_ENOUGH', userId: 'A' });
  });
  it('refuses when the receiver has no room, but not when they give as much as they get', () => {
    const full = holdings('B', { items: { x: true }, bag: { items: BAG.slots, stacks: {} } });
    const sender = holdings('A', { items: { i1: true, i2: true }, bag: { items: 2, stacks: {} } });
    expect(planTrade(sender, offer(['i1']), full, EMPTY_OFFER, BAG)).toEqual({ ok: false, reason: 'BAG_FULL', userId: 'B' });
    expect(planTrade(sender, offer(['i1']), full, offer(['x']), BAG).ok).toBe(true);
  });
  it('lets a stack top up a partly filled slot', () => {
    const b = holdings('B', { bag: { items: BAG.slots - 1, stacks: { shell: 1 } } });
    const a = holdings('A', { stacks: { shell: 3 }, bag: { items: 0, stacks: { shell: 3 } } });
    expect(planTrade(a, offer([], [{ defId: 'shell', count: 3 }]), b, EMPTY_OFFER, BAG).ok).toBe(true);
  });
});
