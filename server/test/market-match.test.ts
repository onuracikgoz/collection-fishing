// Pet stalls against a fake Nakama: opening, viewing, buying, recalling, expiring.
import { describe, expect, it } from 'vitest';
import { BAG, MARKET, TRADE, XP } from '../src/config';
import { MARKET_POINT } from '../src/data/lake-map';
import { OpCode } from '../src/protocol';
import { buildSpots } from '../src/rules/market';
import { totalForLevel } from '../src/rules/xp';
import { MarketEnv, MarketPlayer, handleStallOp, initMarket, ownerLeft, sendStalls, settleEnded, tickMarket } from '../src/match/market';

const SYS = '00000000-0000-0000-0000-000000000000';

type Msg = { op: number; body: any; to: string[] };

function world(opts: { failMulti?: boolean } = {}) {
  const store = new Map<string, any>();
  const wallets: { [userId: string]: { coin: number } } = {};
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const sent: Msg[] = [];
  const notices: any[] = [];
  const nk: any = {
    storageRead: (reqs: { collection: string; key: string; userId: string }[]) =>
      reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)) })),
    accountGetId: (userId: string) => ({ wallet: wallets[userId] || {} }),
    notificationSend: (...args: any[]) => notices.push(args),
    storageWrite: (writes: any[]) => writes.forEach((w) => store.set(key(w.collection, w.key, w.userId), w.value)),
    multiUpdate: (_a: unknown, writes: any[], deletes: any[], wal: any[]) => {
      if (opts.failMulti) throw new Error('boom');
      for (const w of wal) if (((wallets[w.userId] || { coin: 0 }).coin || 0) + (w.changeset.coin || 0) < 0) throw new Error('wallet below zero');
      for (const w of writes) store.set(key(w.collection, w.key, w.userId), w.value);
      for (const d of deletes) store.delete(key(d.collection, d.key, d.userId));
      const acks = wal.map((w) => {
        wallets[w.userId] = { coin: ((wallets[w.userId] || { coin: 0 }).coin || 0) + (w.changeset.coin || 0) };
        return { userId: w.userId, updated: { coin: wallets[w.userId].coin } };
      });
      return { walletUpdateAcks: acks };
    },
  };
  const dispatcher: any = {
    broadcastMessage: (op: number, data: string, to: { userId: string }[]) => sent.push({ op, body: JSON.parse(data), to: to.map((p) => p.userId) }),
  };
  const players: { [id: string]: MarketPlayer } = {};
  const spots = buildSpots(MARKET_POINT, MARKET, () => true);
  const env: MarketEnv = { nk, logger: { error: () => undefined, warn: () => undefined } as any, dispatcher, serverId: 's1', market: initMarket(nk, { error: () => undefined } as any, 's1', spots), players };
  const addPlayer = (
    userId: string,
    o: { coin?: number; level?: number; items?: { id: string; defId: string; locked?: boolean; inBook?: boolean }[]; stacks?: { [d: string]: number }; dx?: number } = {},
  ) => {
    const items = o.items || [];
    const p: MarketPlayer = {
      presence: { userId, sessionId: `s-${userId}`, username: userId, node: 'n' } as any,
      name: userId,
      move: { x: MARKET_POINT.x + (o.dx || 0), y: MARKET_POINT.y },
      energy: 100,
      xp: totalForLevel(o.level ?? MARKET.minLevel, XP),
      bag: { items: items.filter((i) => !i.inBook).length, stacks: { ...(o.stacks || {}) } },
      book: {},
      rod: {} as any,
    };
    players[userId] = p;
    wallets[userId] = { coin: o.coin || 0 };
    if (o.stacks) store.set(key('bag', 'stacks', userId), { stacks: { ...o.stacks } });
    for (const i of items) {
      store.set(key('items', i.id, userId), { instanceId: i.id, defId: i.defId, tier: 'rare', float: 0.5, source: 'fishing', obtainedAt: 1, ...(i.locked ? { locked: true } : {}), ...(i.inBook ? { inBook: true } : {}) });
    }
    return p;
  };
  const results = (to?: string) => sent.filter((m) => m.op === OpCode.STALL_RESULT && (to === undefined || m.to.indexOf(to) >= 0)).map((m) => m.body);
  const last = (to: string) => results(to).slice(-1)[0];
  const op = (userId: string, code: number, body: unknown = {}) => handleStallOp(env, players[userId], code, body);
  return { env, store, wallets, sent, notices, addPlayer, results, last, op, key, players };
}

const item = (id: string, price: number) => ({ instanceId: id, price });

function openOne(w: ReturnType<typeof world>) {
  w.addPlayer('S', { items: [{ id: 'i1', defId: 'lake.fish.carp' }, { id: 'i2', defId: 'lake.fish.pike' }], stacks: { worm: 10 } });
  w.op('S', OpCode.STALL_OPEN, { title: 'Fresh fish', items: [item('i1', 100), item('i2', 250)], stacks: [{ defId: 'worm', count: 6, price: 3 }] });
}

describe('opening a stall', () => {
  it('takes the items out of the bag, keeps them aside and shows the stall to everyone', () => {
    const w = world();
    w.addPlayer('V', { dx: 30 });
    openOne(w);
    expect(w.last('S')).toMatchObject({ action: 'open', ok: true });
    expect(w.store.get(w.key('items', 'i1', 'S')).inStall).toBe(true);
    expect(w.store.get(w.key('bag', 'stacks', 'S'))).toEqual({ stacks: { worm: 4 } });
    expect(w.players.S.bag).toEqual({ items: 0, stacks: { worm: 4 } });
    const doc = w.store.get(w.key('stall', 'state', 'S'));
    expect(doc).toMatchObject({ serverId: 's1', name: 'S', title: 'Fresh fish' });
    expect(doc.expiresAt - doc.openedAt).toBe(MARKET.ttlMs);
    expect(w.store.get(w.key('market', 's1', '00000000-0000-0000-0000-000000000000'))).toEqual({ owners: ['S'] });
    const state = w.sent.filter((m) => m.op === OpCode.STALL_STATE).slice(-1)[0];
    expect(state.to.sort()).toEqual(['S', 'V']);
    expect(state.body.full).toBe(false);
    expect(state.body.stalls[0]).toMatchObject({ userId: 'S', title: 'Fresh fish', total: 3 });
    expect(state.body.stalls[0].top.map((e: any) => [e.defId, e.price])).toEqual([['lake.fish.carp', 100], ['lake.fish.pike', 250], ['worm', 3]]);
  });

  it('puts the second stall on another spot', () => {
    const w = world();
    openOne(w);
    w.addPlayer('T', { items: [{ id: 't1', defId: 'lake.fish.carp' }] });
    w.op('T', OpCode.STALL_OPEN, { items: [item('t1', 5)] });
    expect(w.store.get(w.key('stall', 'state', 'T')).spot).not.toBe(w.store.get(w.key('stall', 'state', 'S')).spot);
  });

  it('refuses in the right order and changes nothing', () => {
    const w = world();
    w.addPlayer('Low', { level: MARKET.minLevel - 1, items: [{ id: 'a', defId: 'lake.fish.carp' }] });
    w.addPlayer('Far', { dx: 60, items: [{ id: 'b', defId: 'lake.fish.carp' }] });
    w.addPlayer('Held', { items: [{ id: 'c', defId: 'lake.fish.carp' }] });
    w.store.set(w.key('player', 'trade_lock', 'Held'), { until: Date.now() + 60000 });
    w.addPlayer('Busy', { items: [{ id: 'd', defId: 'lake.fish.carp' }] });
    w.players.Busy.tradeId = 't';
    w.addPlayer('X', { items: [{ id: 'e', defId: 'lake.fish.carp', locked: true }, { id: 'f', defId: 'lake.fish.carp', inBook: true }, { id: 'g', defId: 'lake.fish.carp' }], stacks: { worm: 2 } });
    const tryOpen = (u: string, body: unknown) => {
      w.op(u, OpCode.STALL_OPEN, body);
      return w.last(u).reason;
    };
    expect(tryOpen('Low', { items: [item('a', 5)] })).toBe('LEVEL_TOO_LOW');
    expect(tryOpen('Far', { items: [item('b', 5)] })).toBe('NOT_IN_MARKET');
    expect(tryOpen('Held', { items: [item('c', 5)] })).toBe('TRADE_LOCKED');
    expect(tryOpen('Busy', { items: [item('d', 5)] })).toBe('BUSY');
    expect(tryOpen('X', { items: [] })).toBe('BAD_REQUEST');
    expect(tryOpen('X', { items: [item('g', 0)] })).toBe('BAD_PRICE');
    expect(tryOpen('X', { items: [item('e', 5)] })).toBe('LOCKED');
    expect(tryOpen('X', { items: [item('f', 5)] })).toBe('NOT_OWNED');
    expect(tryOpen('X', { items: [item('nope', 5)] })).toBe('NOT_OWNED');
    expect(tryOpen('X', { stacks: [{ defId: 'worm', count: 3, price: 1 }] })).toBe('NOT_ENOUGH');
    expect(Object.keys(w.env.market.stalls)).toEqual([]);
    expect(w.store.has(w.key('stall', 'state', 'X'))).toBe(false);
    expect(w.store.get(w.key('items', 'g', 'X')).inStall).toBeUndefined();
    expect(w.players.X.bag).toEqual({ items: 2, stacks: { worm: 2 } });
  });

  it('allows one stall per owner and stops when the spots run out', () => {
    const w = world();
    openOne(w);
    w.op('S', OpCode.STALL_OPEN, { items: [item('i1', 1)] });
    expect(w.last('S').reason).toBe('ALREADY_OPEN');
    // A stall of this owner on another server also counts.
    w.addPlayer('O', { items: [{ id: 'o1', defId: 'lake.fish.carp' }] });
    w.store.set(w.key('stall', 'state', 'O'), { serverId: 'other', items: [], stacks: [], title: '', name: 'O', spot: 0, x: 0, y: 0, openedAt: 0, expiresAt: Date.now() + 1000 });
    w.op('O', OpCode.STALL_OPEN, { items: [item('o1', 1)] });
    expect(w.last('O').reason).toBe('ALREADY_OPEN');
    const w2 = world();
    w2.env.market.spots = w2.env.market.spots.slice(0, 1);
    w2.addPlayer('A', { items: [{ id: 'a', defId: 'lake.fish.carp' }] });
    w2.addPlayer('B', { items: [{ id: 'b', defId: 'lake.fish.carp' }] });
    w2.op('A', OpCode.STALL_OPEN, { items: [item('a', 1)] });
    w2.op('B', OpCode.STALL_OPEN, { items: [item('b', 1)] });
    expect(w2.last('B').reason).toBe('NO_SPOT');
  });

  it('leaves everything as it was when storage fails', () => {
    const w = world({ failMulti: true });
    w.addPlayer('S', { items: [{ id: 'i1', defId: 'lake.fish.carp' }], stacks: { worm: 5 } });
    w.op('S', OpCode.STALL_OPEN, { items: [item('i1', 9)], stacks: [{ defId: 'worm', count: 2, price: 1 }] });
    expect(w.last('S').reason).toBe('ERROR');
    expect(w.env.market.stalls.S).toBeUndefined();
    expect(w.players.S.bag).toEqual({ items: 1, stacks: { worm: 5 } });
  });
});

describe('viewing', () => {
  it('sends the whole list to someone near the pet, not to someone far or for a missing stall', () => {
    const w = world();
    openOne(w);
    w.addPlayer('Near', { dx: 1 });
    w.addPlayer('Far', { dx: 40 });
    w.op('Near', OpCode.STALL_VIEW, { userId: 'S' });
    const list = w.sent.filter((m) => m.op === OpCode.STALL_LIST)[0];
    expect(list.to).toEqual(['Near']);
    expect(list.body.items.map((i: any) => [i.item.instanceId, i.item.float, i.price])).toEqual([['i1', 0.5, 100], ['i2', 0.5, 250]]);
    expect(list.body.stacks).toEqual([{ defId: 'worm', count: 6, price: 3 }]);
    w.op('Far', OpCode.STALL_VIEW, { userId: 'S' });
    expect(w.last('Far').reason).toBe('TOO_FAR');
    w.op('Near', OpCode.STALL_VIEW, { userId: 'nobody' });
    expect(w.last('Near').reason).toBe('NOT_FOUND');
    w.op('Near', OpCode.STALL_VIEW, {});
    expect(w.last('Near').reason).toBe('BAD_REQUEST');
  });

  it('gives a joining player every stall', () => {
    const w = world();
    openOne(w);
    w.addPlayer('J');
    sendStalls(w.env, w.players.J.presence);
    const m = w.sent.filter((x) => x.op === OpCode.STALL_STATE).slice(-1)[0];
    expect(m.to).toEqual(['J']);
    expect(m.body.full).toBe(true);
    expect(m.body.stalls.length).toBe(1);
  });
});

describe('buying', () => {
  it('moves the item, the Coin and the fee in one go, and tells the seller', () => {
    const w = world();
    openOne(w);
    w.addPlayer('B', { coin: 1000, dx: 2 });
    w.op('B', OpCode.STALL_BUY, { userId: 'S', instanceId: 'i2' });
    const r = w.last('B');
    expect(r).toMatchObject({ action: 'buy', ok: true, paid: 250, coin: 750 });
    expect(r.item).toMatchObject({ instanceId: 'i2', defId: 'lake.fish.pike', source: 'trade' });
    // First copy of pike: it goes to the book slot, not the bag.
    expect(r.book).toMatchObject({ kind: 'discovered' });
    expect(w.store.get(w.key('items', 'i2', 'B')).inBook).toBe(true);
    expect(w.store.has(w.key('items', 'i2', 'S'))).toBe(false);
    expect(w.wallets.B.coin).toBe(750);
    expect(w.wallets.S.coin).toBe(250 - 13); // fee: ceil(5 %)
    expect(w.players.B.bag.items).toBe(0);
    expect(w.store.get(w.key('stall', 'state', 'S')).items.map((i: any) => i.instanceId)).toEqual(['i1']);
    expect(w.notices.length).toBe(1);
    expect(w.notices[0][0]).toBe('S');
    expect(w.notices[0][3]).toBe(103);
    expect(w.notices[0][2]).toMatchObject({ defId: 'lake.fish.pike', count: 1, price: 250, fee: 13, buyer: 'B' });
    // The buyer gets the shorter list, everyone the changed stall.
    const list = w.sent.filter((m) => m.op === OpCode.STALL_LIST).slice(-1)[0];
    expect(list.to).toEqual(['B']);
    expect(list.body.items.length).toBe(1);
    expect(w.sent.filter((m) => m.op === OpCode.STALL_STATE).slice(-1)[0].body.stalls[0].total).toBe(2);
  });

  it('sells part of a stack, then closes the stall when the last thing goes', () => {
    const w = world();
    openOne(w);
    w.addPlayer('B', { coin: 1000, dx: 2, stacks: { worm: 1 } });
    w.op('B', OpCode.STALL_BUY, { userId: 'S', defId: 'worm', count: 4 });
    expect(w.last('B')).toMatchObject({ ok: true, defId: 'worm', count: 4, paid: 12, coin: 988 });
    expect(w.players.B.bag.stacks).toEqual({ worm: 5 });
    expect(w.store.get(w.key('bag', 'stacks', 'B'))).toEqual({ stacks: { worm: 5 } });
    expect(w.env.market.stalls.S.doc.stacks).toEqual([{ defId: 'worm', count: 2, price: 3 }]);
    w.op('B', OpCode.STALL_BUY, { userId: 'S', defId: 'worm', count: 2 });
    w.op('B', OpCode.STALL_BUY, { userId: 'S', instanceId: 'i1' });
    w.op('B', OpCode.STALL_BUY, { userId: 'S', instanceId: 'i2' });
    expect(w.last('B').ok).toBe(true);
    expect(w.env.market.stalls.S).toBeUndefined();
    expect(w.store.has(w.key('stall', 'state', 'S'))).toBe(false);
    expect(w.store.get(w.key('market', 's1', '00000000-0000-0000-0000-000000000000'))).toEqual({ owners: [] });
    const gone = w.sent.filter((m) => m.op === OpCode.STALL_STATE).slice(-1)[0];
    expect(gone.body.removed).toEqual(['S']);
  });

  it('refuses without changing anything', () => {
    const w = world();
    openOne(w);
    w.addPlayer('Poor', { coin: 10, dx: 2 });
    w.addPlayer('Far', { coin: 1000, dx: 40 });
    w.addPlayer('Low', { coin: 1000, dx: 2, level: MARKET.minLevel - 1 });
    w.addPlayer('Held', { coin: 1000, dx: 2 });
    w.store.set(w.key('player', 'trade_lock', 'Held'), { until: Date.now() + 60000 });
    w.addPlayer('Busy', { coin: 1000, dx: 2 });
    w.players.Busy.tradeId = 't';
    w.addPlayer('Full', { coin: 1000, dx: 2 });
    w.players.Full.bag = { items: BAG.slots, stacks: {} };
    const reason = (u: string, body: unknown) => {
      w.op(u, OpCode.STALL_BUY, body);
      return w.last(u).reason;
    };
    expect(reason('Poor', { userId: 'S', instanceId: 'i1' })).toBe('NOT_ENOUGH');
    expect(reason('Far', { userId: 'S', instanceId: 'i1' })).toBe('TOO_FAR');
    expect(reason('Low', { userId: 'S', instanceId: 'i1' })).toBe('LEVEL_TOO_LOW');
    expect(reason('Held', { userId: 'S', instanceId: 'i1' })).toBe('TRADE_LOCKED');
    expect(reason('Busy', { userId: 'S', instanceId: 'i1' })).toBe('BUSY');
    expect(reason('Full', { userId: 'S', instanceId: 'i1' })).toBe('BAG_FULL');
    expect(reason('Full', { userId: 'S', defId: 'worm', count: 1 })).toBe('BAG_FULL');
    expect(reason('Poor', { userId: 'S', instanceId: 'nope' })).toBe('NOT_FOUND');
    expect(reason('Poor', { userId: 'ghost', instanceId: 'i1' })).toBe('NOT_FOUND');
    expect(reason('Poor', { userId: 'S', defId: 'worm', count: 99 })).toBe('NOT_ENOUGH');
    expect(reason('Poor', { nonsense: true })).toBe('BAD_REQUEST');
    expect(reason('S', { userId: 'S', instanceId: 'i1' })).toBe('OWN_STALL');
    expect(w.wallets.S.coin).toBe(0);
    expect(w.env.market.stalls.S.doc.items.length).toBe(2);
    expect(w.notices.length).toBe(0);
  });

  it('keeps the stall as it was when the transaction fails', () => {
    const w = world();
    openOne(w);
    w.addPlayer('B', { coin: 1000, dx: 2 });
    const before = JSON.stringify(w.env.market.stalls.S.doc);
    (w.env.nk as any).multiUpdate = () => {
      throw new Error('boom');
    };
    w.op('B', OpCode.STALL_BUY, { userId: 'S', instanceId: 'i1' });
    expect(w.last('B').reason).toBe('ERROR');
    expect(JSON.stringify(w.env.market.stalls.S.doc)).toBe(before);
    expect(w.players.B.bag.items).toBe(0);
  });
});

describe('recall and expiry', () => {
  it('recall brings unsold things back to the bag and clears the stall', () => {
    const w = world();
    openOne(w);
    w.addPlayer('B', { coin: 1000, dx: 2 });
    w.op('B', OpCode.STALL_BUY, { userId: 'S', instanceId: 'i1' });
    w.op('S', OpCode.STALL_RECALL);
    const r = w.last('S');
    expect(r).toMatchObject({ action: 'recall', ok: true });
    expect(r.returned.items.map((i: any) => i.instanceId)).toEqual(['i2']);
    expect(r.returned.stacks).toEqual([{ defId: 'worm', count: 6 }]);
    expect(w.store.get(w.key('items', 'i2', 'S')).inStall).toBeUndefined();
    expect(w.store.get(w.key('bag', 'stacks', 'S'))).toEqual({ stacks: { worm: 10 } });
    expect(w.players.S.bag).toEqual({ items: 1, stacks: { worm: 10 } });
    expect(w.store.has(w.key('stall', 'state', 'S'))).toBe(false);
    expect(w.env.market.stalls.S).toBeUndefined();
    w.op('S', OpCode.STALL_RECALL);
    expect(w.last('S').reason).toBe('NOT_OPEN');
  });

  it('closes the stall when the owner quits the game, and returns what was not sold', () => {
    const w = world();
    openOne(w);
    w.addPlayer('V', { dx: 30 });
    w.store.set(w.key('player', 'session', 'S'), { serverId: 's1' });
    const owner = w.players.S;
    delete w.players.S;
    const before = w.sent.length;
    ownerLeft(w.env, owner);
    expect(w.store.get(w.key('player', 'session', 'S'))).toEqual({ serverId: '' });
    expect(w.env.market.stalls.S).toBeUndefined();
    expect(w.store.has(w.key('stall', 'state', 'S'))).toBe(false);
    expect(w.store.get(w.key('items', 'i1', 'S')).inStall).toBeUndefined();
    expect(w.store.get(w.key('bag', 'stacks', 'S'))).toEqual({ stacks: { worm: 10 } });
    expect(w.store.get(w.key('market', 's1', SYS))).toEqual({ owners: [] });
    // Others see it go; the leaver gets no result.
    const sent = w.sent.slice(before);
    expect(sent.map((m) => m.op)).toEqual([OpCode.STALL_STATE]);
    expect(sent[0].body.removed).toEqual(['S']);
    ownerLeft(w.env, owner);
    expect(w.sent.length).toBe(before + 1);
  });

  it('keeps the stall when the owner only moves to another server', () => {
    const w = world();
    openOne(w);
    // The other server's join already wrote its id before this match saw the leave.
    w.store.set(w.key('player', 'session', 'S'), { serverId: 's2' });
    const owner = w.players.S;
    delete w.players.S;
    ownerLeft(w.env, owner);
    expect(w.env.market.stalls.S).toBeDefined();
    expect(w.store.get(w.key('player', 'session', 'S'))).toEqual({ serverId: 's2' });
    expect(w.store.get(w.key('items', 'i1', 'S')).inStall).toBe(true);
    // The owner cannot open a second stall there, and cannot recall this one from there.
    w.addPlayer('S2', {});
    w.store.set(w.key('stall', 'state', 'S2'), w.store.get(w.key('stall', 'state', 'S')));
    w.op('S2', OpCode.STALL_RECALL);
    expect(w.last('S2').reason).toBe('OTHER_SERVER');
    w.op('S2', OpCode.STALL_OPEN, { items: [item('x', 1)] });
    expect(w.last('S2').reason).toBe('ALREADY_OPEN');
  });

  it('closes a stall whose owner is away when they quit the game elsewhere', () => {
    const w = world();
    openOne(w);
    w.store.set(w.key('player', 'session', 'S'), { serverId: 's2' });
    delete w.players.S;
    tickMarket(w.env);
    expect(w.env.market.stalls.S).toBeDefined();
    // They quit on the other server: its leave wrote ''. This match notices on its next check.
    w.store.set(w.key('player', 'session', 'S'), { serverId: '' });
    tickMarket(w.env);
    expect(w.env.market.stalls.S).toBeDefined(); // the check is rate limited
    w.env.market.lastAwayCheck = 0;
    tickMarket(w.env);
    expect(w.env.market.stalls.S).toBeUndefined();
    expect(w.store.get(w.key('stall', 'state', 'S')).ended).toBe(true);
    const back = settleEnded(w.env.nk, w.env.logger, 'S');
    expect(back && back.items.length).toBe(2);
  });

  it('a match that ends closes the stalls of everyone in it', () => {
    const w = world();
    openOne(w);
    w.store.set(w.key('player', 'session', 'S'), { serverId: 's1' });
    ownerLeft(w.env, w.players.S, true);
    expect(w.env.market.stalls.S).toBeUndefined();
    expect(w.players.S.bag.items).toBe(2);
  });

  it('returns an expired stall at once when the owner is here', () => {
    const w = world();
    openOne(w);
    w.env.market.stalls.S.doc.expiresAt = Date.now() - 1;
    tickMarket(w.env);
    expect(w.last('S')).toMatchObject({ action: 'recall', ok: true, reason: 'EXPIRED' });
    expect(w.env.market.stalls.S).toBeUndefined();
    expect(w.players.S.bag.items).toBe(2);
  });

  it('keeps an expired stall for the owner who is away, and returns it at their next login', () => {
    const w = world();
    openOne(w);
    delete w.players.S;
    w.env.market.stalls.S.doc.expiresAt = Date.now() - 1;
    tickMarket(w.env);
    expect(w.env.market.stalls.S).toBeUndefined();
    expect(w.store.get(w.key('stall', 'state', 'S')).ended).toBe(true);
    expect(w.store.get(w.key('items', 'i1', 'S')).inStall).toBe(true);
    expect(w.store.get(w.key('market', 's1', '00000000-0000-0000-0000-000000000000'))).toEqual({ owners: [] });
    const back = settleEnded(w.env.nk, w.env.logger, 'S');
    expect(back && back.items.length).toBe(2);
    expect(w.store.get(w.key('items', 'i1', 'S')).inStall).toBeUndefined();
    expect(w.store.get(w.key('bag', 'stacks', 'S'))).toEqual({ stacks: { worm: 10 } });
    expect(w.store.has(w.key('stall', 'state', 'S'))).toBe(false);
    expect(settleEnded(w.env.nk, w.env.logger, 'S')).toBeNull();
  });

  it('lets an owner recall a stall left over from a stopped server', () => {
    const w = world();
    openOne(w);
    // The server stopped: a new match ends what the index lists.
    const fresh = initMarket(w.env.nk, w.env.logger, 's1', w.env.market.spots);
    expect(fresh.stalls).toEqual({});
    expect(w.store.get(w.key('stall', 'state', 'S')).ended).toBe(true);
    expect(w.store.get(w.key('market', 's1', '00000000-0000-0000-0000-000000000000'))).toEqual({ owners: [] });
    w.env.market = fresh;
    w.players.S.bag = { items: 0, stacks: { worm: 4 } };
    w.op('S', OpCode.STALL_RECALL);
    expect(w.last('S')).toMatchObject({ ok: true });
    expect(w.players.S.bag).toEqual({ items: 2, stacks: { worm: 10 } });
    expect(w.store.has(w.key('stall', 'state', 'S'))).toBe(false);
  });

  it('only one stall stands per owner, even across servers', () => {
    const w = world();
    w.addPlayer('O', { items: [{ id: 'o1', defId: 'lake.fish.carp' }] });
    w.store.set(w.key('stall', 'state', 'O'), { serverId: 'other', items: [], stacks: [], title: '', name: 'O', spot: 0, x: 0, y: 0, openedAt: 0, expiresAt: Date.now() + 1000 });
    w.op('O', OpCode.STALL_OPEN, { items: [item('o1', 1)] });
    expect(w.last('O').reason).toBe('ALREADY_OPEN');
    w.op('O', OpCode.STALL_RECALL);
    expect(w.last('O').reason).toBe('OTHER_SERVER');
  });
});

describe('items on a stall', () => {
  it('stay out of the bag and cannot be offered in a trade', () => {
    const w = world();
    openOne(w);
    expect(TRADE.minLevel).toBeGreaterThan(0);
    // inBag is the single check bag-level code uses.
    const stored = w.store.get(w.key('items', 'i1', 'S'));
    return import('../src/match/playerData').then((m) => {
      expect(m.inBag(stored)).toBe(false);
      expect(m.publicItem(stored)).not.toHaveProperty('inStall');
    });
  });
});
