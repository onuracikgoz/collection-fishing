// Pet stalls inside the world match (docs/protokol.md, Pazar). Rules are in rules/market.ts.
// A stall's items stay in the owner's `items` records with inStall set, so they leave the bag in one write;
// the match is the only writer of a stall, so its in-memory copy below stays true.
import { BAG, MARKET, XP } from '../config';
import { MARKET_POINT } from '../data/lake-map';
import { FishBookMsg, ItemInstance, OpCode, StallListMsg, StallResultMsg, StallView, StallsMsg } from '../protocol';
import { canAdd, slotsUsed } from '../rules/bag';
import { Listing, Spot, feeOf, nearestFreeSpot, parseBuy, parseListing, planBuy, topEntries } from '../rules/market';
import { levelOf } from '../rules/xp';
import { Fisher } from './fishing';
import { placeNewItem } from './items';
import {
  StallDoc,
  StoredItem,
  inBag,
  itemWrite,
  marketIndexWrite,
  publicItem,
  readMarketIndex,
  readSession,
  readStacks,
  readStall,
  readTradeLock,
  readWallet,
  sessionWrite,
  stacksWrite,
  stallDelete,
  stallWrite,
} from './playerData';

/** Notification code for "your stall sold something" (101 and 102 are login notices). */
export const NOTIFY_STALL_SOLD = 103;

export interface MarketPlayer extends Fisher {
  name: string;
  tradeId?: string;
}

/** A stall as the match keeps it: the stored doc and its items as clients see them. */
export interface StallRec {
  doc: StallDoc;
  items: { [instanceId: string]: ItemInstance };
}

export interface MarketState {
  spots: Spot[];
  /** Wall-clock ms of the last check on owners who are away. */
  lastAwayCheck: number;
  stalls: { [owner: string]: StallRec };
}

export interface MarketEnv {
  nk: nkruntime.Nakama;
  logger: nkruntime.Logger;
  dispatcher: nkruntime.MatchDispatcher;
  serverId: string;
  market: MarketState;
  players: { [userId: string]: MarketPlayer };
}

/**
 * A new match starts with no stalls: they stand only while the match runs. Stalls still stored for
 * this server (it stopped without closing them) are marked ended and come home at their owner's next login.
 */
export function initMarket(nk: nkruntime.Nakama, logger: nkruntime.Logger, serverId: string, spots: Spot[]): MarketState {
  try {
    const owners = readMarketIndex(nk, serverId);
    if (owners.length > 0) {
      const writes: nkruntime.StorageWriteRequest[] = [marketIndexWrite(serverId, [])];
      for (const owner of owners) {
        const doc = readStall(nk, owner);
        if (doc && !doc.ended && doc.serverId === serverId) writes.push(stallWrite(owner, { ...doc, ended: true }));
      }
      nk.multiUpdate(null, writes, [], []);
    }
  } catch (e) {
    logger.error('Ending leftover stalls of %s failed: %s', serverId, String(e));
  }
  return { spots, stalls: {}, lastAwayCheck: 0 };
}

function send(env: MarketEnv, op: number, body: unknown, to: nkruntime.Presence[]): void {
  if (to.length > 0) env.dispatcher.broadcastMessage(op, JSON.stringify(body), to, null, true);
}

const everyone = (env: MarketEnv): nkruntime.Presence[] => Object.keys(env.players).map((id) => env.players[id].presence);

function viewOf(owner: string, rec: StallRec): StallView {
  const info: { [id: string]: { defId: string; tier: string } } = {};
  for (const id in rec.items) info[id] = { defId: rec.items[id].defId, tier: rec.items[id].tier };
  const d = rec.doc;
  return {
    userId: owner,
    name: d.name,
    spot: d.spot,
    x: d.x,
    y: d.y,
    title: d.title,
    top: topEntries(d, info, MARKET.topCount),
    total: d.items.length + d.stacks.length,
    expiresInMs: Math.max(0, d.expiresAt - Date.now()),
  };
}

/** Every stall, for a player who just joined. */
export function sendStalls(env: MarketEnv, to: nkruntime.Presence): void {
  const stalls = Object.keys(env.market.stalls).map((o) => viewOf(o, env.market.stalls[o]));
  const msg: StallsMsg = { full: true, stalls, removed: [] };
  send(env, OpCode.STALL_STATE, msg, [to]);
}

function announce(env: MarketEnv, changed: string[], removed: string[]): void {
  const stalls = changed.filter((o) => env.market.stalls[o]).map((o) => viewOf(o, env.market.stalls[o]));
  const msg: StallsMsg = { full: false, stalls, removed };
  send(env, OpCode.STALL_STATE, msg, everyone(env));
}

function listOf(owner: string, rec: StallRec): StallListMsg {
  const d = rec.doc;
  return {
    userId: owner,
    name: d.name,
    title: d.title,
    items: d.items.map((i) => ({ item: rec.items[i.instanceId], price: i.price })),
    stacks: d.stacks.map((s) => ({ defId: s.defId, count: s.count, price: s.price })),
    expiresInMs: Math.max(0, d.expiresAt - Date.now()),
  };
}

const indexWrite = (env: MarketEnv, without?: string) =>
  marketIndexWrite(env.serverId, Object.keys(env.market.stalls).filter((o) => o !== without));

interface Returned {
  writes: nkruntime.StorageWriteRequest[];
  items: ItemInstance[];
  /** The bag stacks after the return. */
  stacks: { [defId: string]: number };
  returned: { defId: string; count: number }[];
}

/** What coming home takes: the items lose inStall, the stacks join the bag stacks. */
function planReturn(nk: nkruntime.Nakama, userId: string, doc: Listing, bagStacks: { [defId: string]: number }): Returned {
  const writes: nkruntime.StorageWriteRequest[] = [];
  const items: ItemInstance[] = [];
  if (doc.items.length > 0) {
    for (const o of nk.storageRead(doc.items.map((i) => ({ collection: 'items', key: i.instanceId, userId })))) {
      const stored = o.value as StoredItem;
      if (!stored.inStall) continue;
      const item = publicItem(stored);
      items.push(item);
      writes.push(itemWrite(userId, item));
    }
  }
  const stacks = { ...bagStacks };
  for (const st of doc.stacks) stacks[st.defId] = (stacks[st.defId] || 0) + st.count;
  if (doc.stacks.length > 0) writes.push(stacksWrite(userId, stacks));
  return { writes, items, stacks, returned: doc.stacks.map((s) => ({ defId: s.defId, count: s.count })) };
}

/**
 * A stall that expired while its owner was away comes home at the owner's next login, before their bag is loaded.
 * Returns what came back, or null if there was nothing (or storage failed).
 */
export function settleEnded(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string): Returned | null {
  try {
    const doc = readStall(nk, userId);
    if (!doc || !doc.ended) return null;
    const plan = planReturn(nk, userId, doc, readStacks(nk, userId));
    nk.multiUpdate(null, plan.writes, [stallDelete(userId)], []);
    return plan;
  } catch (e) {
    logger.error('Returning the ended stall of %s failed: %s', userId, String(e));
    return null;
  }
}

/** Closes a stall whose owner is in this match: unsold things go back to their bag. Returns false if storage failed. */
function closeStall(env: MarketEnv, owner: string, p: MarketPlayer, reason?: string, quiet = false): boolean {
  const rec = env.market.stalls[owner];
  const plan = planReturn(env.nk, owner, rec.doc, p.bag.stacks);
  try {
    env.nk.multiUpdate(null, plan.writes.concat([indexWrite(env, owner)]), [stallDelete(owner)], []);
  } catch (e) {
    env.logger.error('Closing the stall of %s failed: %s', owner, String(e));
    return false;
  }
  delete env.market.stalls[owner];
  p.bag.items += plan.items.length;
  p.bag.stacks = plan.stacks;
  if (!quiet) {
    const msg: StallResultMsg = { action: 'recall', ok: true, returned: { items: plan.items, stacks: plan.returned } };
    if (reason) msg.reason = reason;
    send(env, OpCode.STALL_RESULT, msg, [p.presence]);
  }
  announce(env, [], [owner]);
  return true;
}

const levelOk = (p: MarketPlayer) => levelOf(p.xp, XP).level >= MARKET.minLevel;
const tradeLocked = (env: MarketEnv, userId: string) => readTradeLock(env.nk, userId) > Date.now();

function handleOpen(env: MarketEnv, p: MarketPlayer, body: unknown): void {
  const userId = p.presence.userId;
  const fail = (reason: string) => send(env, OpCode.STALL_RESULT, { action: 'open', ok: false, reason } as StallResultMsg, [p.presence]);
  if (env.market.stalls[userId]) return fail('ALREADY_OPEN');
  if (p.tradeId) return fail('BUSY');
  if (!levelOk(p)) return fail('LEVEL_TOO_LOW');
  if (tradeLocked(env, userId)) return fail('TRADE_LOCKED');
  const parsed = parseListing(body, MARKET);
  if (!parsed.ok) return fail(parsed.reason);
  const listing = parsed.listing;
  if (Math.hypot(p.move.x - MARKET_POINT.x, p.move.y - MARKET_POINT.y) > MARKET.areaRadius) return fail('NOT_IN_MARKET');

  // A stall that ended while the owner was elsewhere is still stored; bring it home first.
  const old = readStall(env.nk, userId);
  if (old) {
    if (!old.ended) return fail('ALREADY_OPEN');
    const back = settleEnded(env.nk, env.logger, userId);
    if (back) p.bag = { items: p.bag.items + back.items.length, stacks: back.stacks };
  }

  const taken: { [spotId: number]: true } = {};
  for (const o in env.market.stalls) taken[env.market.stalls[o].doc.spot] = true;
  const spot = nearestFreeSpot(env.market.spots, taken, p.move.x, p.move.y);
  if (!spot) return fail('NO_SPOT');

  const writes: nkruntime.StorageWriteRequest[] = [];
  const items: { [id: string]: ItemInstance } = {};
  if (listing.items.length > 0) {
    const found: { [id: string]: StoredItem } = {};
    for (const o of env.nk.storageRead(listing.items.map((i) => ({ collection: 'items', key: i.instanceId, userId })))) found[o.key] = o.value as StoredItem;
    for (const i of listing.items) {
      const item = found[i.instanceId];
      if (!item || !inBag(item)) return fail('NOT_OWNED');
      if (item.locked) return fail('LOCKED');
      items[i.instanceId] = publicItem(item);
      writes.push(itemWrite(userId, { ...item, inStall: true }));
    }
  }
  const stacks = { ...p.bag.stacks };
  for (const st of listing.stacks) {
    if ((stacks[st.defId] || 0) < st.count) return fail('NOT_ENOUGH');
    stacks[st.defId] -= st.count;
    if (stacks[st.defId] === 0) delete stacks[st.defId];
  }
  if (listing.stacks.length > 0) writes.push(stacksWrite(userId, stacks));

  const wall = Date.now();
  const doc: StallDoc = { ...listing, serverId: env.serverId, name: p.name, spot: spot.id, x: spot.x, y: spot.y, openedAt: wall, expiresAt: wall + MARKET.ttlMs };
  writes.push(stallWrite(userId, doc));
  const rec: StallRec = { doc, items };
  env.market.stalls[userId] = rec;
  writes.push(indexWrite(env));
  try {
    env.nk.multiUpdate(null, writes, [], []);
  } catch (e) {
    env.logger.error('Opening the stall of %s failed: %s', userId, String(e));
    delete env.market.stalls[userId];
    return fail('ERROR');
  }
  p.bag.items -= listing.items.length;
  p.bag.stacks = stacks;
  send(env, OpCode.STALL_RESULT, { action: 'open', ok: true, spot: spot.id } as StallResultMsg, [p.presence]);
  announce(env, [userId], []);
}

function handleRecall(env: MarketEnv, p: MarketPlayer): void {
  const userId = p.presence.userId;
  const fail = (reason: string) => send(env, OpCode.STALL_RESULT, { action: 'recall', ok: false, reason } as StallResultMsg, [p.presence]);
  if (env.market.stalls[userId]) {
    if (!closeStall(env, userId, p)) fail('ERROR');
    return;
  }
  const stored = readStall(env.nk, userId);
  if (!stored) return fail('NOT_OPEN');
  if (!stored.ended) return fail('OTHER_SERVER');
  // Left over from a server that stopped: bring it home now, the bag cache here is the live one.
  const back = settleEnded(env.nk, env.logger, userId);
  if (!back) return fail('ERROR');
  p.bag = { items: p.bag.items + back.items.length, stacks: back.stacks };
  send(env, OpCode.STALL_RESULT, { action: 'recall', ok: true, returned: { items: back.items, stacks: back.returned } } as StallResultMsg, [p.presence]);
}

function handleView(env: MarketEnv, p: MarketPlayer, body: unknown): void {
  const fail = (reason: string) => send(env, OpCode.STALL_RESULT, { action: 'view', ok: false, reason } as StallResultMsg, [p.presence]);
  const owner = typeof body === 'object' && body !== null ? (body as { userId?: unknown }).userId : undefined;
  if (typeof owner !== 'string') return fail('BAD_REQUEST');
  const rec = env.market.stalls[owner];
  if (!rec) return fail('NOT_FOUND');
  if (Math.hypot(p.move.x - rec.doc.x, p.move.y - rec.doc.y) > MARKET.interactRadius) return fail('TOO_FAR');
  send(env, OpCode.STALL_LIST, listOf(owner, rec), [p.presence]);
}

function handleBuy(env: MarketEnv, p: MarketPlayer, body: unknown): void {
  const buyer = p.presence.userId;
  const fail = (reason: string) => send(env, OpCode.STALL_RESULT, { action: 'buy', ok: false, reason } as StallResultMsg, [p.presence]);
  const req = parseBuy(body);
  if (!req) return fail('BAD_REQUEST');
  const rec = env.market.stalls[req.owner];
  if (!rec) return fail('NOT_FOUND');
  if (req.owner === buyer) return fail('OWN_STALL');
  if (p.tradeId) return fail('BUSY');
  if (!levelOk(p)) return fail('LEVEL_TOO_LOW');
  if (tradeLocked(env, buyer)) return fail('TRADE_LOCKED');
  if (Math.hypot(p.move.x - rec.doc.x, p.move.y - rec.doc.y) > MARKET.interactRadius) return fail('TOO_FAR');
  const plan = planBuy(rec.doc, req);
  if (!plan.ok) return fail(plan.reason);
  if (readWallet(env.nk, buyer).coin < plan.total) return fail('NOT_ENOUGH');

  const writes: nkruntime.StorageWriteRequest[] = [];
  const deletes: nkruntime.StorageDeleteRequest[] = [];
  let bought: ItemInstance | undefined;
  let placed: ReturnType<typeof placeNewItem> | undefined;
  let stacks = p.bag.stacks;
  const wall = Date.now();
  if (plan.kind === 'item') {
    if (!canAdd(p.bag, null, BAG)) return fail('BAG_FULL');
    const stored = env.nk.storageRead([{ collection: 'items', key: plan.instanceId, userId: req.owner }]);
    if (stored.length === 0 || !(stored[0].value as StoredItem).inStall) return fail('NOT_FOUND');
    bought = { ...publicItem(stored[0].value as StoredItem), source: 'trade', obtainedAt: wall };
    deletes.push({ collection: 'items', key: plan.instanceId, userId: req.owner });
    placed = placeNewItem(buyer, p.book, bought);
    for (const w of placed.writes) writes.push(w);
  } else {
    stacks = { ...p.bag.stacks, [plan.defId]: (p.bag.stacks[plan.defId] || 0) + plan.count };
    if (slotsUsed({ items: p.bag.items, stacks }, BAG) > BAG.slots) return fail('BAG_FULL');
    writes.push(stacksWrite(buyer, stacks));
  }
  const fee = feeOf(plan.total, MARKET);
  const sold = plan.rest.items.length + plan.rest.stacks.length === 0;
  const doc: StallDoc = { ...rec.doc, items: plan.rest.items, stacks: plan.rest.stacks };
  const next: StallRec = { doc, items: { ...rec.items } };
  if (plan.kind === 'item') delete next.items[plan.instanceId];
  if (sold) {
    deletes.push(stallDelete(req.owner));
    writes.push(indexWrite(env, req.owner));
  } else {
    writes.push(stallWrite(req.owner, doc));
  }
  const wallets: nkruntime.WalletUpdate[] = [
    { userId: buyer, changeset: { coin: -plan.total }, metadata: { action: 'stall_buy', owner: req.owner } },
    { userId: req.owner, changeset: { coin: plan.total - fee }, metadata: { action: 'stall_sale', buyer, fee } },
  ];
  let coin: number;
  try {
    const res = env.nk.multiUpdate(null, writes, deletes, wallets);
    coin = res.walletUpdateAcks[0].updated.coin || 0;
  } catch (e) {
    env.logger.error('Stall buy %s -> %s failed: %s', buyer, req.owner, String(e));
    return fail('ERROR');
  }

  if (sold) delete env.market.stalls[req.owner];
  else env.market.stalls[req.owner] = next;
  if (placed) {
    p.book = placed.book || p.book;
    if (placed.inBag) p.bag.items += 1;
  } else {
    p.bag.stacks = stacks;
  }
  const res: StallResultMsg = { action: 'buy', ok: true, paid: plan.total, coin };
  if (bought) res.item = bought;
  else {
    res.defId = plan.kind === 'stack' ? plan.defId : '';
    res.count = plan.kind === 'stack' ? plan.count : 0;
  }
  if (placed && placed.msg) res.book = placed.msg as FishBookMsg;
  send(env, OpCode.STALL_RESULT, res, [p.presence]);
  if (!sold) send(env, OpCode.STALL_LIST, listOf(req.owner, next), [p.presence]);
  announce(env, sold ? [] : [req.owner], sold ? [req.owner] : []);

  try {
    const what = plan.kind === 'item' ? { defId: bought ? bought.defId : '', count: 1 } : { defId: plan.defId, count: plan.count };
    env.nk.notificationSend(req.owner, 'stall_sold', { ...what, price: plan.total, fee, buyer: p.name }, NOTIFY_STALL_SOLD, null, true);
  } catch (e) {
    env.logger.warn('Sale notice not sent to %s: %s', req.owner, String(e));
  }
}

/**
 * The owner left this server. If they went to another server the stall stays; if they left the game it closes
 * and unsold things go back to their bag. `force` (the match is ending) closes it either way.
 */
export function ownerLeft(env: MarketEnv, p: MarketPlayer, force = false): void {
  const owner = p.presence.userId;
  try {
    const where = readSession(env.nk, owner);
    if (where === env.serverId) env.nk.storageWrite([sessionWrite(owner, '')]);
    else if (where !== '' && !force) return;
  } catch (e) {
    env.logger.error('Reading the session of %s failed: %s', owner, String(e));
    return;
  }
  if (env.market.stalls[owner]) closeStall(env, owner, p, undefined, true);
}

export function handleStallOp(env: MarketEnv, p: MarketPlayer, op: number, body: unknown): void {
  if (op === OpCode.STALL_OPEN) handleOpen(env, p, body);
  else if (op === OpCode.STALL_RECALL) handleRecall(env, p);
  else if (op === OpCode.STALL_VIEW) handleView(env, p, body);
  else if (op === OpCode.STALL_BUY) handleBuy(env, p, body);
}

/** Marks a stall whose owner is not here as ended: it leaves the market and comes home at the owner's next login. */
function endAway(env: MarketEnv, owner: string): void {
  const rec = env.market.stalls[owner];
  try {
    env.nk.multiUpdate(null, [stallWrite(owner, { ...rec.doc, ended: true }), indexWrite(env, owner)], [], []);
  } catch (e) {
    env.logger.error('Ending the stall of %s failed: %s', owner, String(e));
    return;
  }
  delete env.market.stalls[owner];
  announce(env, [], [owner]);
}

/** Every tick: stalls past their time come home; now and then, stalls whose owner quit the game close. */
export function tickMarket(env: MarketEnv): void {
  const wall = Date.now();
  const check = wall - env.market.lastAwayCheck >= MARKET.awayCheckMs;
  if (check) env.market.lastAwayCheck = wall;
  for (const owner in env.market.stalls) {
    const rec = env.market.stalls[owner];
    const p = env.players[owner];
    if (wall >= rec.doc.expiresAt) {
      if (p) closeStall(env, owner, p, 'EXPIRED');
      else endAway(env, owner);
    } else if (!p && check) {
      // Away from this server: gone only if not playing on another one either.
      let where = env.serverId;
      try {
        where = readSession(env.nk, owner);
      } catch (e) {
        env.logger.error('Reading the session of %s failed: %s', owner, String(e));
      }
      if (where === '') endAway(env, owner);
    }
  }
}
