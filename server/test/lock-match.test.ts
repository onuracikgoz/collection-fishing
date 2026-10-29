// Item lock against a fake Nakama: locking, and the actions that must refuse a locked item.
import { describe, expect, it } from 'vitest';
import { OpCode } from '../src/protocol';
import { handleCraft } from '../src/match/craft';
import { handleEconomy } from '../src/match/economy';
import { handleItemLock } from '../src/match/lock';
import { handleTradeOp, TradeEnv, TradePlayer, TradeRec } from '../src/match/trade';

function fake() {
  const store = new Map<string, any>();
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const sent: { op: number; body: any }[] = [];
  const nk: any = {
    storageRead: (reqs: { collection: string; key: string; userId: string }[]) =>
      reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)) })),
    storageWrite: (writes: any[]) => writes.forEach((w) => store.set(key(w.collection, w.key, w.userId), w.value)),
    accountGetId: () => ({ wallet: { coin: 0, dust: 100 } }),
    multiUpdate: () => {
      throw new Error('a locked item must never reach the transaction');
    },
    uuidv4: () => 'id',
  };
  const dispatcher: any = { broadcastMessage: (op: number, data: string) => sent.push({ op, body: JSON.parse(data) }) };
  const logger: any = { error: () => undefined };
  const f: TradePlayer = { presence: { userId: 'A', sessionId: 's', username: 'A', node: 'n' } as any, name: 'A', move: { x: 1, y: 1 }, energy: 1, xp: 1_000_000, bag: { items: 3, stacks: {} }, book: {}, rod: {} as any };
  const put = (id: string, extra: object = {}) => store.set(key('items', id, 'A'), { instanceId: id, defId: 'lake.fish.carp', tier: 'common', float: 0.5, source: 'fishing', obtainedAt: 1, ...extra });
  return { store, key, sent, nk, dispatcher, logger, f, put };
}

describe('item lock (fake Nakama)', () => {
  it('locks and unlocks a bag item, and only bag items', () => {
    const w = fake();
    w.put('i1');
    w.put('ib', { inBook: true });
    handleItemLock(w.nk, w.logger, w.dispatcher, w.f, { instanceId: 'i1', locked: true });
    expect(w.store.get(w.key('items', 'i1', 'A')).locked).toBe(true);
    handleItemLock(w.nk, w.logger, w.dispatcher, w.f, { instanceId: 'i1', locked: true });
    handleItemLock(w.nk, w.logger, w.dispatcher, w.f, { instanceId: 'i1', locked: false });
    expect('locked' in w.store.get(w.key('items', 'i1', 'A'))).toBe(false);
    handleItemLock(w.nk, w.logger, w.dispatcher, w.f, { instanceId: 'ib', locked: true });
    handleItemLock(w.nk, w.logger, w.dispatcher, w.f, { instanceId: 'nope', locked: true });
    handleItemLock(w.nk, w.logger, w.dispatcher, w.f, { instanceId: 'i1' });
    const r = w.sent.filter((m) => m.op === OpCode.ITEM_LOCK_RESULT).map((m) => [m.body.ok, m.body.locked, m.body.reason]);
    expect(r).toEqual([[true, true, undefined], [true, true, undefined], [true, false, undefined], [false, false, 'NOT_OWNED'], [false, false, 'NOT_OWNED'], [false, false, 'BAD_REQUEST']]);
  });

  it('refuses to sell, salvage, merge or craft with a locked item', () => {
    const w = fake();
    w.put('i1', { locked: true });
    w.put('i2');
    w.put('i3');
    handleEconomy(w.nk, w.logger, w.dispatcher, w.f, 'sell', { items: ['i1'] });
    handleEconomy(w.nk, w.logger, w.dispatcher, w.f, 'salvage', { items: ['i2', 'i1'] });
    handleCraft(w.nk, w.logger, w.dispatcher, w.f, 'merge', { items: ['i1', 'i2', 'i3'] });
    handleCraft(w.nk, w.logger, w.dispatcher, w.f, 'craft', { recipeId: 'x', items: ['i1'] });
    expect(w.sent.map((m) => [m.body.ok, m.body.reason])).toEqual([[false, 'LOCKED'], [false, 'LOCKED'], [false, 'LOCKED'], [false, 'LOCKED']]);
  });

  it('keeps a locked item out of a trade window', () => {
    const w = fake();
    w.put('i1', { locked: true });
    const b: TradePlayer = { ...w.f, presence: { userId: 'B', sessionId: 'sb', username: 'B', node: 'n' } as any, name: 'B' };
    const env: TradeEnv = { nk: w.nk, logger: w.logger, dispatcher: w.dispatcher, fishing: {} as any, serverId: 'mercan', players: { A: w.f, B: b }, trades: {} as { [id: string]: TradeRec } };
    handleTradeOp(env, w.f, OpCode.TRADE_OFFER, { userId: 'B' }, 0);
    handleTradeOp(env, b, OpCode.TRADE_REPLY, { accept: true }, 1);
    handleTradeOp(env, w.f, OpCode.TRADE_SET, { items: ['i1'] }, 2);
    const last = w.sent.filter((m) => m.op === OpCode.TRADE_STATE).slice(-1)[0].body;
    expect(last.reason).toBe('LOCKED');
    expect(last.you.items).toEqual([]);
  });
});
