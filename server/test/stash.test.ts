import { describe, expect, it } from 'vitest';
import { BAG, STASH } from '../src/config';
import { parseEconomyRequest } from '../src/rules/economy';
import { atBank, planExpand, planMove, stashBagConfig, stashSlots } from '../src/rules/stash';

const req = (body: unknown) => parseEconomyRequest(body)!;

describe('stash', () => {
  it('opens only near the bank', () => {
    expect(atBank(STASH.bank, STASH)).toBe(true);
    expect(atBank({ x: STASH.bank.x + 2.9, y: STASH.bank.y }, STASH)).toBe(true);
    expect(atBank({ x: STASH.bank.x + 3.1, y: STASH.bank.y }, STASH)).toBe(false);
  });

  it('grows by expensive tiers up to 200 slots', () => {
    expect(stashSlots(0, STASH)).toBe(100);
    expect(planExpand(0, 2000, STASH)).toEqual({ ok: true, level: 1, price: 2000 });
    expect(planExpand(1, 4999, STASH)).toEqual({ ok: false, reason: 'NOT_ENOUGH_COIN' });
    expect(stashSlots(5, STASH)).toBe(200);
    expect(planExpand(5, 1e9, STASH)).toEqual({ ok: false, reason: 'MAX_LEVEL' });
  });

  it('moves items and stacks all at once', () => {
    const bag = { items: 2, stacks: { boot: 10, scale: 3 } };
    const stash = { items: 0, stacks: { boot: 5 } };
    const r = planMove(req({ items: ['a'], stacks: [{ defId: 'boot', count: 10 }, { defId: 'scale', count: 1 }] }), { a: true, b: true }, bag, stash, stashBagConfig(0, STASH), 40);
    expect(r).toEqual({
      ok: true,
      items: ['a'],
      stacks: [{ defId: 'boot', count: 10 }, { defId: 'scale', count: 1 }],
      from: { items: 1, stacks: { scale: 2 } },
      to: { items: 1, stacks: { boot: 15, scale: 1 } },
    });
    // Inputs stay as they were.
    expect(bag.stacks.boot).toBe(10);
  });

  it('refuses what is not on the leaving side', () => {
    const bag = { items: 1, stacks: { boot: 2 } };
    const to = { items: 0, stacks: {} };
    const cfg = stashBagConfig(0, STASH);
    expect(planMove(req({ items: ['x'] }), { a: true }, bag, to, cfg, 40)).toEqual({ ok: false, reason: 'NOT_OWNED' });
    expect(planMove(req({ items: ['a', 'a'] }), { a: true }, bag, to, cfg, 40)).toEqual({ ok: false, reason: 'BAD_REQUEST' });
    expect(planMove(req({ stacks: [{ defId: 'boot', count: 3 }] }), {}, bag, to, cfg, 40)).toEqual({ ok: false, reason: 'NOT_ENOUGH' });
    expect(planMove(req({ stacks: [{ defId: 'moss', count: 1 }] }), {}, bag, to, cfg, 40)).toEqual({ ok: false, reason: 'NOT_OWNED' });
    expect(planMove(req({}), {}, bag, to, cfg, 40)).toEqual({ ok: false, reason: 'BAD_REQUEST' });
    expect(planMove(req({ items: ['a', 'b'] }), { a: true, b: true }, bag, to, cfg, 1)).toEqual({ ok: false, reason: 'TOO_MANY' });
  });

  it('needs room on the receiving side, counted in 99-stacks', () => {
    const stash = { items: 99, stacks: { boot: 98 } };
    const cfg = stashBagConfig(0, STASH);
    expect(planMove(req({ stacks: [{ defId: 'boot', count: 1 }] }), {}, { items: 0, stacks: { boot: 2 } }, stash, cfg, 40).ok).toBe(true);
    expect(planMove(req({ stacks: [{ defId: 'boot', count: 2 }] }), {}, { items: 0, stacks: { boot: 2 } }, stash, cfg, 40)).toEqual({ ok: false, reason: 'FULL' });
    expect(planMove(req({ items: ['a'] }), { a: true }, { items: 1, stacks: {} }, { items: BAG.slots, stacks: {} }, BAG, 40)).toEqual({ ok: false, reason: 'FULL' });
  });
});
