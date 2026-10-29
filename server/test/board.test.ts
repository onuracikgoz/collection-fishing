// The market board: ads for a stall, paid in diamonds (fake Nakama).
import { describe, expect, it } from 'vitest';
import { BOARD, MARKET, XP } from '../src/config';
import { MARKET_POINT } from '../src/data/lake-map';
import { OpCode } from '../src/protocol';
import { liveHighlights, parseAdRequest, planAd } from '../src/rules/board';
import { buildSpots } from '../src/rules/market';
import { totalForLevel } from '../src/rules/xp';
import { MarketEnv, MarketPlayer, handleStallOp, initMarket, sendBoard, tickMarket } from '../src/match/market';

describe('board rules', () => {
  it('reads an ad request', () => {
    expect(parseAdRequest({ action: 'remove' }, BOARD)).toEqual({ action: 'remove' });
    expect(parseAdRequest({ action: 'set', highlights: [] }, BOARD)).toEqual({ action: 'set', highlights: [] });
    expect(parseAdRequest({ action: 'set' }, BOARD)).toEqual({ action: 'set', highlights: [] });
    // Unity sends both fields; the filled one counts. A repeat is dropped.
    expect(parseAdRequest({ action: 'set', highlights: [{ instanceId: 'a', defId: '' }, { instanceId: '', defId: 'worm' }, { instanceId: 'a', defId: '' }] }, BOARD)).toEqual({ action: 'set', highlights: ['a', 'worm'] });
    for (const b of [null, 'x', {}, { action: 'buy' }, { action: 'set', highlights: 'a' }, { action: 'set', highlights: [{ instanceId: '', defId: '' }] }, { action: 'set', highlights: [1] }]) expect(parseAdRequest(b, BOARD)).toBeNull();
    const many = Array.from({ length: BOARD.maxHighlights + 1 }, (_, i) => ({ instanceId: `i${i}`, defId: '' }));
    expect(parseAdRequest({ action: 'set', highlights: many }, BOARD)).toBeNull();
  });

  it('charges a new ad, changes a running one for free, and stops at full or poor', () => {
    expect(planAd(false, 0, BOARD.priceDiamonds, BOARD)).toEqual({ ok: true, charge: BOARD.priceDiamonds });
    expect(planAd(true, BOARD.slots, 0, BOARD)).toEqual({ ok: true, charge: 0 });
    expect(planAd(false, BOARD.slots, 999, BOARD)).toEqual({ ok: false, reason: 'BOARD_FULL' });
    expect(planAd(false, 0, BOARD.priceDiamonds - 1, BOARD)).toEqual({ ok: false, reason: 'NOT_ENOUGH_DIAMOND' });
  });

  it('keeps the highlights the stall still has, in order', () => {
    expect(liveHighlights(['b', 'worm', 'gone'], [{ instanceId: 'a' }, { instanceId: 'b' }], [{ defId: 'worm' }])).toEqual(['b', 'worm']);
  });
});

type Msg = { op: number; body: any; to: string[] };

function world() {
  const store = new Map<string, any>();
  const wallets: { [u: string]: { coin: number; diamond: number } } = {};
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const sent: Msg[] = [];
  let uuid = 0;
  const nk: any = {
    uuidv4: () => `log-${++uuid}`,
    storageRead: (reqs: any[]) => reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)) })),
    accountGetId: (u: string) => ({ wallet: wallets[u] || {} }),
    storageWrite: (ws: any[]) => ws.forEach((w) => store.set(key(w.collection, w.key, w.userId), w.value)),
    walletUpdate: (u: string, change: { diamond?: number }) => {
      const w = wallets[u];
      if (w.diamond + (change.diamond || 0) < 0) throw new Error('below zero');
      w.diamond += change.diamond || 0;
      return { updated: { ...w } };
    },
    multiUpdate: (_a: unknown, writes: any[], deletes: any[]) => {
      for (const w of writes) store.set(key(w.collection, w.key, w.userId), w.value);
      for (const d of deletes) store.delete(key(d.collection, d.key, d.userId));
      return { walletUpdateAcks: [] };
    },
  };
  const dispatcher: any = { broadcastMessage: (op: number, data: string, to: { userId: string }[]) => sent.push({ op, body: JSON.parse(data), to: to.map((p) => p.userId) }) };
  const players: { [id: string]: MarketPlayer } = {};
  const spots = buildSpots(MARKET_POINT, MARKET, () => true);
  const env: MarketEnv = { nk, logger: { error: () => undefined, warn: () => undefined } as any, dispatcher, serverId: 's1', market: initMarket(nk, { error: () => undefined } as any, 's1', spots), players };
  const addPlayer = (userId: string, o: { diamond?: number; items?: string[]; stacks?: { [d: string]: number } } = {}) => {
    const items = o.items || [];
    players[userId] = {
      presence: { userId, sessionId: `s-${userId}`, username: userId, node: 'n' } as any,
      name: userId,
      move: { x: MARKET_POINT.x, y: MARKET_POINT.y },
      energy: 100,
      xp: totalForLevel(MARKET.minLevel, XP),
      bag: { items: items.length, stacks: { ...(o.stacks || {}) } },
      book: {},
      rod: {} as any,
    };
    wallets[userId] = { coin: 0, diamond: o.diamond ?? 0 };
    if (o.stacks) store.set(key('bag', 'stacks', userId), { stacks: { ...o.stacks } });
    for (const id of items) store.set(key('items', id, userId), { instanceId: id, defId: 'lake.fish.carp', tier: 'rare', float: 0.5, source: 'fishing', obtainedAt: 1 });
  };
  const op = (u: string, code: number, body: unknown = {}) => handleStallOp(env, players[u], code, body);
  const board = () => sent.filter((m) => m.op === OpCode.BOARD_STATE);
  const result = (to: string) => sent.filter((m) => m.op === OpCode.BOARD_RESULT && m.to.indexOf(to) >= 0).map((m) => m.body).slice(-1)[0];
  return { env, store, wallets, sent, addPlayer, op, board, result, key };
}

function openStall(w: ReturnType<typeof world>, user = 'S', diamond = 25) {
  w.addPlayer(user, { diamond, items: [`${user}1`, `${user}2`, `${user}3`], stacks: { worm: 10 } });
  w.op(user, OpCode.STALL_OPEN, {
    title: 'Fresh fish',
    items: [1, 2, 3].map((n) => ({ instanceId: `${user}${n}`, price: 100 * n })),
    stacks: [{ defId: 'worm', count: 6, price: 3 }],
  });
}

const adBody = (...ids: string[]) => ({ action: 'set', highlights: ids.map((id) => (id === 'worm' ? { instanceId: '', defId: id } : { instanceId: id, defId: '' })) });

describe('putting a stall on the board', () => {
  it('takes the price in diamonds and shows the ad to everyone with the picked entries', () => {
    const w = world();
    w.addPlayer('V');
    openStall(w);
    w.op('S', OpCode.BOARD_AD, adBody('S3', 'worm'));
    expect(w.result('S')).toEqual({ action: 'set', ok: true, diamond: 25 - BOARD.priceDiamonds });
    expect(w.wallets.S.diamond).toBe(25 - BOARD.priceDiamonds);
    const msg = w.board().slice(-1)[0];
    expect(msg.to.sort()).toEqual(['S', 'V']);
    expect(msg.body.full).toBe(false);
    expect(msg.body.ads[0]).toMatchObject({ userId: 'S', title: 'Fresh fish', total: 4 });
    expect(msg.body.ads[0].top.map((e: any) => e.defId).sort()).toEqual(['lake.fish.carp', 'worm']);
    expect(msg.body.ads[0].top.find((e: any) => e.defId === 'lake.fish.carp').price).toBe(300);
    expect(msg.body.ads[0].expiresInMs).toBeGreaterThan(MARKET.ttlMs - 5000);
  });

  it('uses the first entries of the stall when none are picked', () => {
    const w = world();
    openStall(w);
    w.op('S', OpCode.BOARD_AD, adBody());
    expect(w.board().slice(-1)[0].body.ads[0].top.length).toBe(4);
  });

  it('changing a running ad is free and keeps its place; taking it down does not refund', () => {
    const w = world();
    openStall(w);
    w.op('S', OpCode.BOARD_AD, adBody('S1'));
    const startedAt = w.env.market.ads.S.startedAt;
    w.op('S', OpCode.BOARD_AD, adBody('S2'));
    expect(w.wallets.S.diamond).toBe(25 - BOARD.priceDiamonds);
    expect(w.env.market.ads.S.startedAt).toBe(startedAt);
    expect(w.board().slice(-1)[0].body.ads[0].top.map((e: any) => e.price)).toEqual([200]);
    w.op('S', OpCode.BOARD_AD, { action: 'remove' });
    expect(w.result('S')).toEqual({ action: 'remove', ok: true });
    expect(w.board().slice(-1)[0].body).toMatchObject({ ads: [], removed: ['S'] });
    expect(w.wallets.S.diamond).toBe(25 - BOARD.priceDiamonds);
    expect(w.env.market.ads.S).toBeUndefined();
  });

  it('refuses without a stall, without enough diamonds, for entries not on the stall, and when full', () => {
    const w = world();
    w.addPlayer('N', { diamond: 100 });
    w.op('N', OpCode.BOARD_AD, adBody());
    expect(w.result('N').reason).toBe('NO_STALL');
    openStall(w, 'S', BOARD.priceDiamonds - 1);
    w.op('S', OpCode.BOARD_AD, adBody());
    expect(w.result('S').reason).toBe('NOT_ENOUGH_DIAMOND');
    expect(w.wallets.S.diamond).toBe(BOARD.priceDiamonds - 1);
    w.op('S', OpCode.BOARD_AD, adBody('not-mine'));
    expect(w.result('S').reason).toBe('NOT_IN_STALL');
    w.op('S', OpCode.BOARD_AD, { action: 'dance' });
    expect(w.result('S').reason).toBe('BAD_REQUEST');
    // Fill the board with other stalls' ads, then one more is turned away.
    for (let i = 0; i < BOARD.slots; i++) {
      openStall(w, `F${i}`, 100);
      w.op(`F${i}`, OpCode.BOARD_AD, adBody());
    }
    expect(Object.keys(w.env.market.ads).length).toBe(BOARD.slots);
    openStall(w, 'L', 100);
    w.op('L', OpCode.BOARD_AD, adBody());
    expect(w.result('L').reason).toBe('BOARD_FULL');
    expect(w.wallets.L.diamond).toBe(100);
  });

  it('an ad goes with its stall, and ends by itself after its time', () => {
    const w = world();
    openStall(w);
    openStall(w, 'T', 50);
    w.op('S', OpCode.BOARD_AD, adBody());
    w.op('T', OpCode.BOARD_AD, adBody());
    // The owner recalls the stall: the ad is gone with it.
    w.op('S', OpCode.STALL_RECALL);
    expect(w.env.market.ads.S).toBeUndefined();
    expect(w.board().slice(-1)[0].body.removed).toEqual(['S']);
    // Time passes: the stall is still open but the ad has run out.
    w.env.market.ads.T.until = Date.now() - 1;
    tickMarket(w.env);
    expect(w.env.market.ads.T).toBeUndefined();
    expect(w.env.market.stalls.T).toBeDefined();
    expect(w.board().slice(-1)[0].body.removed).toEqual(['T']);
  });

  it('a joiner gets the board, oldest ad first, and an ad drops sold-out picks', () => {
    const w = world();
    openStall(w, 'A', 50);
    openStall(w, 'B', 50);
    w.op('B', OpCode.BOARD_AD, adBody('B1'));
    w.env.market.ads.B.startedAt -= 1000;
    w.op('A', OpCode.BOARD_AD, adBody('worm'));
    w.addPlayer('J');
    sendBoard(w.env, w.env.players.J.presence);
    const full = w.board().slice(-1)[0];
    expect(full.to).toEqual(['J']);
    expect(full.body.full).toBe(true);
    expect(full.body.ads.map((a: any) => a.userId)).toEqual(['B', 'A']);
  });
});
