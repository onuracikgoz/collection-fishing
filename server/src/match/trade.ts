// The safe trade window inside the world match (docs/protokol.md, Takas).
// Rules are in rules/trade.ts. This file moves messages around and makes the swap one storage transaction.
// The match is the only writer of both bags, so their cached stacks and item counts stay true.
import { BAG, TRADE, XP } from '../config';
import { FishBookMsg, ItemInstance, OpCode, TradeEndMsg, TradeInviteMsg, TradeOfferView, TradeResult, TradeStateMsg } from '../protocol';
import { BookEntries } from '../rules/book';
import {
  Holdings,
  Session,
  accept,
  confirm,
  confirmInMs,
  newSession,
  otherOf,
  parseOffer,
  planTrade,
  setLock,
  setOffer,
  slots,
} from '../rules/trade';
import { levelOf } from '../rules/xp';
import { FishingContext, Fisher, cancelFishing } from './fishing';
import { placeNewItem } from './items';
import { StoredItem, bookWrite, inBag, publicItem, readTradeLock, readWallet, stacksWrite } from './playerData';

/** The part of a match player that trading needs. */
export interface TradePlayer extends Fisher {
  name: string;
  tradeId?: string;
  lastOfferAt?: number;
}

/** A session plus the items on each side as clients see them (Float and all). */
export interface TradeRec {
  s: Session;
  views: { [userId: string]: ItemInstance[] };
}

export interface TradeEnv {
  nk: nkruntime.Nakama;
  logger: nkruntime.Logger;
  dispatcher: nkruntime.MatchDispatcher;
  fishing: FishingContext;
  players: { [userId: string]: TradePlayer };
  trades: { [tradeId: string]: TradeRec };
}

function send(env: TradeEnv, op: number, body: unknown, to: nkruntime.Presence[]): void {
  env.dispatcher.broadcastMessage(op, JSON.stringify(body), to, null, true);
}

const viewOf = (rec: TradeRec, userId: string): TradeOfferView => {
  const o = rec.s.offers[userId];
  return { items: rec.views[userId] || [], stacks: o.stacks, coin: o.coin };
};

function stateFor(env: TradeEnv, rec: TradeRec, userId: string, now: number, reason?: string): TradeStateMsg {
  const s = rec.s;
  const other = otherOf(s, userId);
  const msg: TradeStateMsg = {
    tradeId: s.id,
    withId: other,
    withName: env.players[other] ? env.players[other].name : '',
    you: viewOf(rec, userId),
    them: viewOf(rec, other),
    youLocked: s.locked[userId],
    themLocked: s.locked[other],
    youConfirmed: s.confirmed[userId],
    themConfirmed: s.confirmed[other],
  };
  const wait = confirmInMs(s, now, TRADE);
  if (wait !== null) msg.confirmInMs = wait;
  if (reason) msg.reason = reason;
  return msg;
}

function pushState(env: TradeEnv, rec: TradeRec, now: number): void {
  for (const id of [rec.s.a, rec.s.b]) {
    const p = env.players[id];
    if (p) send(env, OpCode.TRADE_STATE, stateFor(env, rec, id, now), [p.presence]);
  }
}

/** Closes a session: both sides hear about it and are free again. */
function end(env: TradeEnv, rec: TradeRec, result: TradeResult, reason?: string, extra: { [userId: string]: Partial<TradeEndMsg> } = {}, userId?: string): void {
  for (const id of [rec.s.a, rec.s.b]) {
    const p = env.players[id];
    if (!p) continue;
    if (p.tradeId === rec.s.id) p.tradeId = undefined;
    const msg: TradeEndMsg = { tradeId: rec.s.id, result, ...(extra[id] || {}) };
    if (reason) msg.reason = reason;
    if (userId) msg.userId = userId;
    send(env, OpCode.TRADE_END, msg, [p.presence]);
  }
  delete env.trades[rec.s.id];
}

/** A refusal before any session exists. */
function refuse(env: TradeEnv, p: TradePlayer, reason: string): void {
  const msg: TradeEndMsg = { tradeId: '', result: 'failed', reason };
  send(env, OpCode.TRADE_END, msg, [p.presence]);
}

/** The first of these players below the trade level, or null. */
function belowLevel(env: TradeEnv, ids: string[]): string | null {
  for (const id of ids) {
    const p = env.players[id];
    if (p && levelOf(p.xp, XP).level < TRADE.minLevel) return id;
  }
  return null;
}

/** The first of these players whose account may not trade yet (a newly linked Steam account), or null. */
function tradeLocked(env: TradeEnv, ids: string[]): string | null {
  const now = Date.now();
  for (const id of ids) if (readTradeLock(env.nk, id) > now) return id;
  return null;
}

const distance = (a: TradePlayer, b: TradePlayer) => Math.hypot(a.move.x - b.move.x, a.move.y - b.move.y);

function recOf(env: TradeEnv, p: TradePlayer): TradeRec | null {
  return p.tradeId && env.trades[p.tradeId] ? env.trades[p.tradeId] : null;
}

function handleOffer(env: TradeEnv, p: TradePlayer, body: unknown, now: number): void {
  const targetId = typeof body === 'object' && body !== null ? (body as { userId?: unknown }).userId : undefined;
  if (typeof targetId !== 'string') return;
  if (targetId === p.presence.userId) return refuse(env, p, 'SELF');
  if (p.lastOfferAt !== undefined && now - p.lastOfferAt < TRADE.offerCooldownMs) return refuse(env, p, 'RATE_LIMITED');
  p.lastOfferAt = now;
  const target = env.players[targetId];
  if (!target) return refuse(env, p, 'NOT_HERE');
  if (p.tradeId || target.tradeId) return refuse(env, p, 'BUSY');
  if (distance(p, target) > TRADE.maxDistance) return refuse(env, p, 'TOO_FAR');
  const low = belowLevel(env, [p.presence.userId, targetId]);
  if (low !== null) return refuse(env, p, low === p.presence.userId ? 'LEVEL_TOO_LOW' : 'TARGET_LEVEL_TOO_LOW');
  const held = tradeLocked(env, [p.presence.userId, targetId]);
  if (held !== null) return refuse(env, p, held === p.presence.userId ? 'TRADE_LOCKED' : 'TARGET_TRADE_LOCKED');
  cancelFishing(env.fishing, p);
  const s = newSession(env.nk.uuidv4(), p.presence.userId, targetId, now, TRADE);
  env.trades[s.id] = { s, views: { [s.a]: [], [s.b]: [] } };
  p.tradeId = s.id;
  target.tradeId = s.id;
  const invite: TradeInviteMsg = { tradeId: s.id, from: p.presence.userId, name: p.name, expiresInMs: TRADE.inviteMs };
  send(env, OpCode.TRADE_INVITE, invite, [target.presence]);
}

function handleReply(env: TradeEnv, p: TradePlayer, body: unknown, now: number): void {
  const rec = recOf(env, p);
  if (!rec || rec.s.phase !== 'invite' || rec.s.b !== p.presence.userId) return;
  const yes = typeof body === 'object' && body !== null && (body as { accept?: unknown }).accept === true;
  if (!yes) return end(env, rec, 'declined');
  const a = env.players[rec.s.a];
  if (!a) return end(env, rec, 'cancelled', 'NOT_HERE');
  if (distance(a, p) > TRADE.maxDistance) return end(env, rec, 'cancelled', 'TOO_FAR');
  if (tradeLocked(env, [a.presence.userId, p.presence.userId]) !== null) return end(env, rec, 'cancelled', 'TRADE_LOCKED');
  cancelFishing(env.fishing, p);
  accept(rec.s, now, TRADE);
  pushState(env, rec, now);
}

function handleSet(env: TradeEnv, p: TradePlayer, body: unknown, now: number): void {
  const rec = recOf(env, p);
  if (!rec || rec.s.phase !== 'open') return;
  const userId = p.presence.userId;
  const reject = (reason: string) => send(env, OpCode.TRADE_STATE, stateFor(env, rec, userId, now, reason), [p.presence]);
  const offer = parseOffer(body);
  if (!offer) return reject('BAD_REQUEST');
  if (slots(offer) > TRADE.maxSlots) return reject('TOO_MANY');
  // Only bag items can be offered: book slot and stash items are skipped by inBag.
  const views: ItemInstance[] = [];
  if (offer.items.length > 0) {
    const found: { [id: string]: StoredItem } = {};
    for (const o of env.nk.storageRead(offer.items.map((key) => ({ collection: 'items', key, userId })))) found[o.key] = o.value as StoredItem;
    for (const id of offer.items) {
      if (!found[id] || !inBag(found[id])) return reject('NOT_OWNED');
      if (found[id].locked) return reject('LOCKED');
      views.push(publicItem(found[id]));
    }
  }
  for (const st of offer.stacks) if ((p.bag.stacks[st.defId] || 0) < st.count) return reject('NOT_ENOUGH');
  if (offer.coin > 0 && readWallet(env.nk, userId).coin < offer.coin) return reject('NOT_ENOUGH');
  setOffer(rec.s, userId, offer);
  rec.views[userId] = views;
  pushState(env, rec, now);
}

function handleLock(env: TradeEnv, p: TradePlayer, body: unknown, now: number): void {
  const rec = recOf(env, p);
  if (!rec || rec.s.phase !== 'open') return;
  const lock = typeof body === 'object' && body !== null && (body as { locked?: unknown }).locked === true;
  setLock(rec.s, p.presence.userId, lock, now);
  pushState(env, rec, now);
}

function handleConfirm(env: TradeEnv, p: TradePlayer, now: number): void {
  const rec = recOf(env, p);
  if (!rec || rec.s.phase !== 'open') return;
  const res = confirm(rec.s, p.presence.userId, now, TRADE);
  if (res === 'ready') return execute(env, rec);
  pushState(env, rec, now);
}

/** The swap: items change owner, stacks and Coin move, the log is written, all in one transaction. */
function execute(env: TradeEnv, rec: TradeRec): void {
  const s = rec.s;
  const pa = env.players[s.a];
  const pb = env.players[s.b];
  if (!pa || !pb) return end(env, rec, 'cancelled', 'NOT_HERE');
  const held = tradeLocked(env, [s.a, s.b]);
  if (held !== null) return end(env, rec, 'failed', 'TRADE_LOCKED', {}, held);

  // Read the offered items fresh: anything that left the bag since TRADE_SET is gone.
  const stored: { [userId: string]: { [id: string]: StoredItem } } = { [s.a]: {}, [s.b]: {} };
  const hold = (p: TradePlayer): Holdings => {
    const userId = p.presence.userId;
    const offer = s.offers[userId];
    const items: { [id: string]: true } = {};
    if (offer.items.length > 0) {
      for (const o of env.nk.storageRead(offer.items.map((key) => ({ collection: 'items', key, userId })))) {
        const item = o.value as StoredItem;
        // An item locked after TRADE_SET counts as gone.
        if (inBag(item) && !item.locked) {
          items[o.key] = true;
          stored[userId][o.key] = item;
        }
      }
    }
    return { userId, items, stacks: p.bag.stacks, coin: readWallet(env.nk, userId).coin, bag: p.bag };
  };
  const ha = hold(pa);
  const hb = hold(pb);
  const plan = planTrade(ha, s.offers[s.a], hb, s.offers[s.b], BAG);
  if (!plan.ok) return end(env, rec, 'failed', plan.reason, {}, plan.userId);

  const writes: nkruntime.StorageWriteRequest[] = [];
  const deletes: nkruntime.StorageDeleteRequest[] = [];
  const now = Date.now();
  const gotItems: { [userId: string]: ItemInstance[] } = { [s.a]: [], [s.b]: [] };
  const books: { [userId: string]: (FishBookMsg & { instanceId: string })[] } = { [s.a]: [], [s.b]: [] };
  const newBook: { [userId: string]: BookEntries } = { [s.a]: pa.book, [s.b]: pb.book };
  const kept: { [userId: string]: number } = { [s.a]: 0, [s.b]: 0 };
  for (const side of [plan.a, plan.b]) {
    const giver = side.userId === s.a ? s.b : s.a;
    for (const id of side.getItems) {
      const item: ItemInstance = { ...publicItem(stored[giver][id]), source: 'trade', obtainedAt: now };
      deletes.push({ collection: 'items', key: id, userId: giver });
      const placed = placeNewItem(side.userId, newBook[side.userId], item);
      // The book entry is written once at the end; placeNewItem returns it with each item.
      for (const w of placed.writes) if (w.collection === 'items') writes.push(w);
      if (placed.book) newBook[side.userId] = placed.book;
      if (placed.msg) books[side.userId].push({ instanceId: id, ...placed.msg });
      if (placed.inBag) kept[side.userId]++;
      gotItems[side.userId].push(item);
    }
    if (side.getStacks.length > 0 || side.giveStacks.length > 0) writes.push(stacksWrite(side.userId, side.stacksAfter));
    if (newBook[side.userId] !== (side.userId === s.a ? pa.book : pb.book)) writes.push(bookWrite(side.userId, newBook[side.userId]));
  }
  const log = (userId: string, other: string, side: typeof plan.a) => ({
    collection: 'trades',
    key: s.id,
    userId,
    value: { with: other, at: now, gave: { items: side.giveItems, stacks: side.giveStacks, coin: s.offers[userId].coin }, got: { items: gotItems[userId].map((i) => i.instanceId), stacks: side.getStacks, coin: s.offers[other].coin } },
    permissionRead: 0 as nkruntime.ReadPermissionValues,
    permissionWrite: 0 as nkruntime.WritePermissionValues,
  });
  writes.push(log(s.a, s.b, plan.a), log(s.b, s.a, plan.b));
  const wallets: nkruntime.WalletUpdate[] = [];
  for (const side of [plan.a, plan.b]) {
    if (side.coinDelta !== 0) wallets.push({ userId: side.userId, changeset: { coin: side.coinDelta }, metadata: { action: 'trade', tradeId: s.id } });
  }
  try {
    env.nk.multiUpdate(null, writes, deletes, wallets);
  } catch (e) {
    env.logger.error('Trade %s failed: %s', s.id, String(e));
    return end(env, rec, 'failed', 'ERROR');
  }

  for (const [p, side] of [[pa, plan.a], [pb, plan.b]] as [TradePlayer, typeof plan.a][]) {
    p.bag.stacks = side.stacksAfter;
    p.bag.items = p.bag.items - side.giveItems.length + kept[side.userId];
    p.book = newBook[side.userId];
  }
  const extra: { [userId: string]: Partial<TradeEndMsg> } = {};
  for (const [side, other] of [[plan.a, s.b], [plan.b, s.a]] as [typeof plan.a, string][]) {
    extra[side.userId] = {
      got: { items: gotItems[side.userId], stacks: side.getStacks, coin: s.offers[other].coin },
      gave: { items: side.giveItems, stacks: side.giveStacks, coin: s.offers[side.userId].coin },
      book: books[side.userId],
    };
  }
  end(env, rec, 'done', undefined, extra);
}

export function handleTradeOp(env: TradeEnv, p: TradePlayer, op: number, body: unknown, now: number): void {
  if (op === OpCode.TRADE_OFFER) handleOffer(env, p, body, now);
  else if (op === OpCode.TRADE_REPLY) handleReply(env, p, body, now);
  else if (op === OpCode.TRADE_SET) handleSet(env, p, body, now);
  else if (op === OpCode.TRADE_LOCK) handleLock(env, p, body, now);
  else if (op === OpCode.TRADE_CONFIRM) handleConfirm(env, p, now);
  else if (op === OpCode.TRADE_CANCEL) {
    const rec = recOf(env, p);
    if (rec) end(env, rec, 'cancelled');
  }
}

/** Every tick: invites and windows that ran out, and pairs that drifted apart. */
export function tickTrades(env: TradeEnv, now: number): void {
  for (const id in env.trades) {
    const rec = env.trades[id];
    const a = env.players[rec.s.a];
    const b = env.players[rec.s.b];
    if (!a || !b) end(env, rec, 'cancelled', 'NOT_HERE');
    else if (now >= rec.s.expiresAt) end(env, rec, 'expired');
    else if (distance(a, b) > TRADE.maxDistance) end(env, rec, 'cancelled', 'TOO_FAR');
  }
}

/** A player left the match: their session ends for the other side. */
export function cancelTradeOf(env: TradeEnv, userId: string): void {
  for (const id in env.trades) {
    const rec = env.trades[id];
    if (rec.s.a === userId || rec.s.b === userId) end(env, rec, 'cancelled', 'NOT_HERE');
  }
}

