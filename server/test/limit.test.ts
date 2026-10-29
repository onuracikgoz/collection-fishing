// RPC rate limit (node-local cache) and the trade log entries.
import { describe, expect, it } from 'vitest';
import { RPC_LIMITS } from '../src/config';
import { rpcLimit } from '../src/rpc/limit';
import { logKey, stallEntries } from '../src/rules/tradeLog';

function cacheNk() {
  const cache = new Map<string, any>();
  return { cache, nk: { localcacheGet: (k: string) => cache.get(k), localcachePut: (k: string, v: any) => cache.set(k, v) } as any };
}
const code = (fn: () => void) => {
  try {
    fn();
  } catch (e: any) {
    return JSON.parse(e.message).code;
  }
  return 'NO_ERROR';
};

describe('rpcLimit', () => {
  it('lets calls through up to the limit, then refuses until the window moves on', () => {
    const { nk } = cacheNk();
    const cfg = RPC_LIMITS.rpcs.friends_status;
    for (let i = 0; i < cfg.perWindow; i++) rpcLimit(nk, 'u1', 'friends_status', 1000 + i);
    expect(code(() => rpcLimit(nk, 'u1', 'friends_status', 1000 + cfg.perWindow))).toBe('RATE_LIMITED');
    // Another player and another RPC have their own budget.
    expect(code(() => rpcLimit(nk, 'u2', 'friends_status', 1010))).toBe('NO_ERROR');
    expect(code(() => rpcLimit(nk, 'u1', 'get_book', 1010))).toBe('NO_ERROR');
    expect(code(() => rpcLimit(nk, 'u1', 'friends_status', 1000 + cfg.windowMs))).toBe('NO_ERROR');
  });

  it('uses the default for RPCs without their own limit, and skips calls without a user or cache', () => {
    const { nk } = cacheNk();
    for (let i = 0; i < RPC_LIMITS.default.perWindow; i++) rpcLimit(nk, 'u1', 'something_new', 5000);
    expect(code(() => rpcLimit(nk, 'u1', 'something_new', 5000))).toBe('RATE_LIMITED');
    expect(code(() => rpcLimit(nk, undefined, 'something_new', 5000))).toBe('NO_ERROR');
    expect(code(() => rpcLimit({} as any, 'u1', 'something_new', 5000))).toBe('NO_ERROR');
  });

  it('survives a broken cache value', () => {
    const { nk, cache } = cacheNk();
    cache.set('rl:get_book:u1', 'not json');
    expect(code(() => rpcLimit(nk, 'u1', 'get_book', 1))).toBe('NO_ERROR');
    cache.set('rl:get_book:u1', '{"a":1}');
    expect(code(() => rpcLimit(nk, 'u1', 'get_book', 2))).toBe('NO_ERROR');
  });
});

describe('trade log', () => {
  it('keys sort by time', () => {
    expect(logKey(5, 'trade', 't1') < logKey(40, 'trade', 't0')).toBe(true);
    expect(logKey(1700000000000, 'stall_buy', 'x')).toBe('001700000000000_stall_buy_x');
  });

  it('writes both sides of a stall purchase', () => {
    const e = stallEntries(
      { buyer: 'B', buyerName: 'Bora', seller: 'S', sellerName: 'Sena', at: 10, serverId: 'mercan', key: 'k1' },
      { stack: { defId: 'lake.mat.scale', count: 3 } },
      30,
      2,
    );
    expect(e.buyer).toEqual({
      kind: 'stall_buy', with: 'S', withName: 'Sena', at: 10, serverId: 'mercan', ref: 'k1',
      gave: { items: [], stacks: [], coin: 30 },
      got: { items: [], stacks: [{ defId: 'lake.mat.scale', count: 3 }], coin: 0 },
    });
    expect(e.seller).toMatchObject({ kind: 'stall_sale', with: 'B', withName: 'Bora', fee: 2, got: { coin: 28 }, gave: { stacks: [{ defId: 'lake.mat.scale', count: 3 }] } });
  });
});
