// The trade window against a fake Nakama: messages, storage and the swap itself.
import { describe, expect, it } from 'vitest';
import { BAG, TRADE } from '../src/config';
import { OpCode } from '../src/protocol';
import { TradeEnv, TradePlayer, TradeRec, cancelTradeOf, handleTradeOp, tickTrades } from '../src/match/trade';

type Msg = { op: number; body: any; to: string[] };

function world() {
  const store = new Map<string, any>();
  const wallets: { [userId: string]: { coin: number } } = {};
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  let uuid = 0;
  const sent: Msg[] = [];
  const nk: any = {
    uuidv4: () => `trade-${++uuid}`,
    storageRead: (reqs: { collection: string; key: string; userId: string }[]) =>
      reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)) })),
    accountGetId: (userId: string) => ({ wallet: wallets[userId] || {} }),
    multiUpdate: (_a: unknown, writes: any[], deletes: any[], wal: any[]) => {
      for (const w of wal) {
        const next = ((wallets[w.userId] || { coin: 0 }).coin || 0) + (w.changeset.coin || 0);
        if (next < 0) throw new Error('wallet below zero');
      }
      for (const w of writes) store.set(key(w.collection, w.key, w.userId), w.value);
      for (const d of deletes) store.delete(key(d.collection, d.key, d.userId));
      for (const w of wal) wallets[w.userId] = { coin: ((wallets[w.userId] || { coin: 0 }).coin || 0) + (w.changeset.coin || 0) };
      return { walletUpdateAcks: [] };
    },
  };
  const dispatcher: any = {
    broadcastMessage: (op: number, data: string, to: { userId: string }[]) => sent.push({ op, body: JSON.parse(data), to: to.map((p) => p.userId) }),
  };
  const players: { [id: string]: TradePlayer } = {};
  const trades: { [id: string]: TradeRec } = {};
  const env: TradeEnv = { nk, logger: { error: () => undefined } as any, dispatcher, fishing: {} as any, players, trades };
  const addPlayer = (userId: string, x: number, coin = 0, items: { id: string; defId: string; float?: number; inBook?: boolean }[] = [], stacks: { [d: string]: number } = {}, book: any = {}) => {
    const p: TradePlayer = {
      presence: { userId, sessionId: `s-${userId}`, username: userId, node: 'n' } as any,
      name: userId,
      move: { x, y: 10 },
      energy: 100,
      bag: { items: items.filter((i) => !i.inBook).length, stacks: { ...stacks } },
      book,
      rod: {} as any,
    };
    players[userId] = p;
    wallets[userId] = { coin };
    for (const i of items) {
      store.set(key('items', i.id, userId), { instanceId: i.id, defId: i.defId, tier: 'rare', float: i.float ?? 0.5, source: 'fishing', obtainedAt: 1, ...(i.inBook ? { inBook: true } : {}) });
    }
    return p;
  };
  const take = (op: number, to?: string) => {
    const out = sent.filter((m) => m.op === op && (to === undefined || m.to.indexOf(to) >= 0));
    return out;
  };
  return { env, store, wallets, sent, addPlayer, take, key, players };
}

/** Opens a window between A and B. */
function open(w: ReturnType<typeof world>, now = 0) {
  handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, now);
  handleTradeOp(w.env, w.players.B, OpCode.TRADE_REPLY, { accept: true }, now);
}

describe('trade window (fake Nakama)', () => {
  it('invites, opens on accept, and holds both players', () => {
    const w = world();
    w.addPlayer('A', 10);
    w.addPlayer('B', 12);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, 0);
    const inv = w.take(OpCode.TRADE_INVITE, 'B');
    expect(inv.length).toBe(1);
    expect(inv[0].body.from).toBe('A');
    expect(w.players.A.tradeId).toBeDefined();
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_REPLY, { accept: true }, 100);
    expect(w.take(OpCode.TRADE_STATE).length).toBe(2);
    expect(Object.keys(w.env.trades).length).toBe(1);
  });

  it('refuses offers to self, far away, absent or busy players, and spam', () => {
    const w = world();
    w.addPlayer('A', 10);
    w.addPlayer('B', 12);
    w.addPlayer('C', 40);
    w.addPlayer('D', 11);
    const reasons = () => w.take(OpCode.TRADE_END).map((m) => m.body.reason);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'A' }, 0);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'C' }, 10000);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'Z' }, 20000);
    expect(reasons()).toEqual(['SELF', 'TOO_FAR', 'NOT_HERE']);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, 30000);
    handleTradeOp(w.env, w.players.D, OpCode.TRADE_OFFER, { userId: 'B' }, 30000);
    expect(reasons().slice(3)).toEqual(['BUSY']);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_CANCEL, {}, 30001);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, 30002);
    expect(reasons().slice(-1)).toEqual(['RATE_LIMITED']);
  });

  it('keeps a newly linked account out of trades, on both sides', () => {
    const w = world();
    w.addPlayer('A', 10);
    w.addPlayer('B', 12);
    w.store.set(w.key('player', 'trade_lock', 'A'), { until: Date.now() + 60000 });
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, 0);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_OFFER, { userId: 'A' }, 0);
    expect(w.take(OpCode.TRADE_END).map((m) => [m.to[0], m.body.reason])).toEqual([['A', 'TRADE_LOCKED'], ['B', 'TARGET_TRADE_LOCKED']]);
    expect(w.players.A.tradeId).toBeUndefined();
    // A lock that ran out no longer counts.
    w.store.set(w.key('player', 'trade_lock', 'A'), { until: Date.now() - 1 });
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, 10000);
    expect(w.take(OpCode.TRADE_INVITE).length).toBe(1);
  });

  it('declines, expires and cancels cleanly', () => {
    const w = world();
    w.addPlayer('A', 10);
    w.addPlayer('B', 12);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, 0);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_REPLY, { accept: false }, 1);
    expect(w.take(OpCode.TRADE_END).map((m) => m.body.result)).toEqual(['declined', 'declined']);
    expect(w.players.A.tradeId).toBeUndefined();
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_OFFER, { userId: 'B' }, 10000);
    tickTrades(w.env, 10000 + TRADE.inviteMs);
    expect(w.take(OpCode.TRADE_END).slice(-1)[0].body.result).toBe('expired');
    expect(Object.keys(w.env.trades).length).toBe(0);
  });

  it('cancels when the pair drifts apart or someone leaves', () => {
    const w = world();
    w.addPlayer('A', 10);
    w.addPlayer('B', 12);
    open(w);
    w.players.B.move.x = 12 + TRADE.maxDistance + 1;
    tickTrades(w.env, 1000);
    expect(w.take(OpCode.TRADE_END)[0].body.reason).toBe('TOO_FAR');
    w.players.B.move.x = 12;
    open(w, 20000);
    delete w.players.B;
    cancelTradeOf(w.env, 'B');
    expect(w.take(OpCode.TRADE_END).slice(-1)[0].body.reason).toBe('NOT_HERE');
    expect(w.players.A.tradeId).toBeUndefined();
  });

  it('refuses a TRADE_SET with items that are not in the bag, too many slots, or too much coin', () => {
    const w = world();
    w.addPlayer('A', 10, 50, [{ id: 'i1', defId: 'lake.fish.carp' }, { id: 'ib', defId: 'lake.fish.pike', inBook: true }], { shell: 2 });
    w.addPlayer('B', 12);
    open(w);
    const reason = (body: unknown) => {
      handleTradeOp(w.env, w.players.A, OpCode.TRADE_SET, body, 10);
      return w.take(OpCode.TRADE_STATE, 'A').slice(-1)[0].body.reason;
    };
    expect(reason({ items: ['ib'] })).toBe('NOT_OWNED');
    expect(reason({ items: ['nope'] })).toBe('NOT_OWNED');
    expect(reason({ stacks: [{ defId: 'shell', count: 3 }] })).toBe('NOT_ENOUGH');
    expect(reason({ coin: 51 })).toBe('NOT_ENOUGH');
    expect(reason({ items: 'x' })).toBe('BAD_REQUEST');
    const many = Array.from({ length: TRADE.maxSlots + 1 }, (_v, i) => `i${i}`);
    expect(reason({ items: many })).toBe('TOO_MANY');
    expect(reason({ items: ['i1'], coin: 50 })).toBeUndefined();
  });

  it('swaps items, stacks and coin after both lock, wait, and confirm', () => {
    const w = world();
    w.addPlayer('A', 10, 100, [{ id: 'i1', defId: 'lake.fish.carp', float: 0.1 }], { shell: 5 });
    w.addPlayer('B', 12, 10, [{ id: 'i2', defId: 'lake.fish.pike', float: 0.2 }, { id: 'i3', defId: 'lake.fish.carp', float: 0.3 }], {}, { 'lake.fish.carp': { foundAt: 1 } });
    open(w);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_SET, { items: ['i1'], stacks: [{ defId: 'shell', count: 2 }], coin: 30 }, 10);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_SET, { items: ['i2', 'i3'] }, 11);
    // The other side sees Float and condition inputs.
    const seen = w.take(OpCode.TRADE_STATE, 'A').slice(-1)[0].body;
    expect(seen.them.items.map((i: any) => [i.instanceId, i.float])).toEqual([['i2', 0.2], ['i3', 0.3]]);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_LOCK, { locked: true }, 20);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_LOCK, { locked: true }, 21);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_CONFIRM, {}, 22);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_CONFIRM, {}, 22);
    expect(w.take(OpCode.TRADE_END).length).toBe(0);
    const t = 21 + TRADE.countdownMs;
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_CONFIRM, {}, t);
    expect(w.take(OpCode.TRADE_END).length).toBe(0);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_CONFIRM, {}, t);

    const ends = w.take(OpCode.TRADE_END);
    expect(ends.map((m) => m.body.result)).toEqual(['done', 'done']);
    // Items changed owner; the old owner's copy is gone.
    expect(w.store.has(w.key('items', 'i1', 'A'))).toBe(false);
    expect(w.store.get(w.key('items', 'i1', 'B')).source).toBe('trade');
    expect(w.store.has(w.key('items', 'i2', 'B'))).toBe(false);
    expect(w.store.has(w.key('items', 'i2', 'A'))).toBe(true);
    // A had no pike or second carp: the pike is a new find and goes to A's book slot, so it is not in the bag.
    expect(w.store.get(w.key('items', 'i2', 'A')).inBook).toBe(true);
    expect(w.store.get(w.key('book', 'entries', 'A')).entries['lake.fish.pike'].slot.instanceId).toBe('i2');
    expect(w.store.get(w.key('items', 'i3', 'A')).inBook).toBe(true);
    expect(w.players.A.bag.items).toBe(0);
    // B already knew the carp, so the copy takes a bag slot.
    expect(w.store.get(w.key('items', 'i1', 'B')).inBook).toBeUndefined();
    expect(w.players.B.bag.items).toBe(1);
    // Stacks and coin.
    expect(w.store.get(w.key('bag', 'stacks', 'A')).stacks).toEqual({ shell: 3 });
    expect(w.store.get(w.key('bag', 'stacks', 'B')).stacks).toEqual({ shell: 2 });
    expect(w.players.A.bag.stacks).toEqual({ shell: 3 });
    expect(w.wallets.A.coin).toBe(70);
    expect(w.wallets.B.coin).toBe(40);
    // Result messages and the log.
    const toA = ends.filter((m) => m.to.indexOf('A') >= 0)[0].body;
    expect(toA.got.items.map((i: any) => i.instanceId)).toEqual(['i2', 'i3']);
    expect(toA.book.filter((b: any) => b.instanceId === 'i2')[0].kind).toBe('discovered');
    expect(toA.got.coin).toBe(0);
    expect(toA.gave.coin).toBe(30);
    expect(w.store.has(w.key('trades', 'trade-1', 'A'))).toBe(true);
    expect(w.store.has(w.key('trades', 'trade-1', 'B'))).toBe(true);
    expect(w.players.A.tradeId).toBeUndefined();
    expect(Object.keys(w.env.trades).length).toBe(0);
  });

  it('fails the swap, and changes nothing, if an offered item left the bag after TRADE_SET', () => {
    const w = world();
    w.addPlayer('A', 10, 0, [{ id: 'i1', defId: 'lake.fish.carp' }]);
    w.addPlayer('B', 12, 10);
    open(w);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_SET, { items: ['i1'] }, 10);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_SET, { coin: 5 }, 11);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_LOCK, { locked: true }, 20);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_LOCK, { locked: true }, 21);
    // A sells (or stashes) the item meanwhile.
    w.store.delete(w.key('items', 'i1', 'A'));
    const t = 21 + TRADE.countdownMs;
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_CONFIRM, {}, t);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_CONFIRM, {}, t);
    const end = w.take(OpCode.TRADE_END)[0].body;
    expect(end.result).toBe('failed');
    expect(end.reason).toBe('ITEM_GONE');
    expect(end.userId).toBe('A');
    expect(w.wallets.B.coin).toBe(10);
    expect(w.store.has(w.key('trades', 'trade-1', 'A'))).toBe(false);
  });

  it('fails when the receiver has no room', () => {
    const w = world();
    w.addPlayer('A', 10, 0, [{ id: 'i1', defId: 'lake.fish.carp' }]);
    w.addPlayer('B', 12);
    w.players.B.bag.items = BAG.slots;
    open(w);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_SET, { items: ['i1'] }, 10);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_LOCK, { locked: true }, 20);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_LOCK, { locked: true }, 21);
    const t = 21 + TRADE.countdownMs;
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_CONFIRM, {}, t);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_CONFIRM, {}, t);
    const end = w.take(OpCode.TRADE_END)[0].body;
    expect([end.result, end.reason, end.userId]).toEqual(['failed', 'BAG_FULL', 'B']);
    expect(w.store.has(w.key('items', 'i1', 'A'))).toBe(true);
  });

  it('reopens the locks when either side changes its offer', () => {
    const w = world();
    w.addPlayer('A', 10, 20);
    w.addPlayer('B', 12);
    open(w);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_LOCK, { locked: true }, 10);
    handleTradeOp(w.env, w.players.B, OpCode.TRADE_LOCK, { locked: true }, 11);
    handleTradeOp(w.env, w.players.A, OpCode.TRADE_SET, { coin: 20 }, 12);
    const last = w.take(OpCode.TRADE_STATE, 'B').slice(-1)[0].body;
    expect([last.youLocked, last.themLocked, last.confirmInMs]).toEqual([false, false, undefined]);
    expect(last.them.coin).toBe(20);
  });
});
