// Developer-only RPCs for tools/dev-dashboard. Registered only when DEV_TOOLS=true
// (see debug/gate.ts and main.ts); test and live servers never have them.
// They bypass the game's own rules on purpose (give items, set Coin, edit the book)
// so every system can be tested without playing for hours.
import {
  BAG,
  BOOK_LUCK,
  CATCH,
  CATCH_TABLE,
  CRAFT,
  ECONOMY,
  EMOTES,
  ENERGY,
  FISHING,
  FLOAT_TABLE,
  FRIENDS,
  LEVEL,
  PROFILE,
  REEL_PARAMS,
  SCORE,
  SERVERS,
  USERNAME,
  WATER,
  WORLD,
  XP,
} from '../config';
import { BOOK_PAGES } from '../data/book-pages';
import { LAKE_MAP } from '../data/lake-map';
import { LAKE_POOL } from '../data/lake-pool';
import { RECIPES, STARTER_RECIPES, recipeById } from '../data/recipes';
import { OpCode, PROTOCOL_VERSION, ItemInstance, Tier } from '../protocol';
import { BookEntries, luckOf, scoreOf } from '../rules/book';
import { Category, ItemDef, rollFloat, tierOf } from '../rules/catch';
import { craftBands, isStackOutput, qualityRow } from '../rules/craft';
import { planEconomy } from '../rules/economy';
import { buildCollisionMap, isWalkable } from '../rules/map';
import { reelParamsFor } from '../rules/fishing';
import { simulateReel } from '../rules/reel';
import { buildWaterMap, bandAt, Band } from '../rules/water';
import { levelOf, totalForLevel } from '../rules/xp';
import { placeNewItem } from '../match/items';
import { findWorldMatches } from '../match/servers';
import {
  StoredItem,
  bookWrite,
  currentEnergy,
  energyWrite,
  itemWrite,
  profileWrite,
  publicItem,
  readBook,
  readInventory,
  readItem,
  readProfile,
  readWallet,
  stacksWrite,
  xpWrite,
} from '../match/playerData';
import { rpcGetBook } from '../rpc/getBook';
import { rpcGetProfile } from '../rpc/profile';
import { isDevEnabled } from './gate';
import { conditionName, mapRows, pageIdOf, simulateCatches, solveReel } from './sim';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIERS: Tier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const BANDS: Band[] = ['shore', 'mid', 'deep'];
/** Collections a player's game data lives in (match/playerData.ts). */
const PLAYER_COLLECTIONS = ['items', 'bag', 'book', 'profile', 'player'];

type Body = { [k: string]: any };

function fail(message: string, code = 3): nkruntime.Error {
  return { message: JSON.stringify({ code: 'BAD_REQUEST', message }), code } as nkruntime.Error;
}

/** Every dev RPC starts with this: off unless DEV_TOOLS=true. */
const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';

function devOnly(ctx: nkruntime.Context): void {
  if (!isDevEnabled(ctx)) throw { message: JSON.stringify({ code: 'DEV_TOOLS_OFF', message: 'developer tools are off on this server' }), code: 7 } as nkruntime.Error;
}

function parse(payload: string): Body {
  if (!payload) return {};
  try {
    const v = JSON.parse(payload);
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v;
  } catch (_e) {
    // fall through
  }
  throw fail('payload is not a JSON object');
}

/** The target player: `userId` from the body, else the caller. */
function target(ctx: nkruntime.Context, nk: nkruntime.Nakama, body: Body): string {
  const id = body.userId !== undefined ? body.userId : ctx.userId;
  if (typeof id !== 'string' || !UUID.test(id)) throw fail('userId missing or bad');
  if (nk.usersGetId([id]).length === 0) throw fail('no such user', 5);
  return id;
}

/** Sends a signal to every world match; replies are parsed JSON. */
function signalAll(nk: nkruntime.Nakama, logger: nkruntime.Logger, msg: object): Body[] {
  const out: Body[] = [];
  const matches = findWorldMatches(nk);
  for (const serverId in matches) {
    try {
      const r = JSON.parse(nk.matchSignal(matches[serverId].matchId, JSON.stringify(msg)) || '{}');
      out.push({ matchId: matches[serverId].matchId, ...r });
    } catch (e) {
      logger.warn('dev signal to %s failed: %s', serverId, String(e));
    }
  }
  return out;
}

/** The match the player is in right now, with the signal's reply, or null. */
function signalPlayer(nk: nkruntime.Nakama, logger: nkruntime.Logger, msg: { type: string; userId: string; [k: string]: unknown }): Body | null {
  for (const r of signalAll(nk, logger, msg)) if (r.found) return r;
  return null;
}

/** Live match copies of bag, book and energy must follow storage edits. */
function reload(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string): boolean {
  return signalPlayer(nk, logger, { type: 'dev_reload', userId }) !== null;
}

function listItems(nk: nkruntime.Nakama, userId: string): StoredItem[] {
  const out: StoredItem[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 50; page++) {
    const res: nkruntime.StorageObjectList = nk.storageList(userId, 'items', 100, cursor);
    for (const o of res.objects || []) out.push(o.value as StoredItem);
    cursor = res.cursor;
    if (!cursor) break;
  }
  return out;
}

function readStacks(nk: nkruntime.Nakama, userId: string): { [defId: string]: number } {
  const objs = nk.storageRead([{ collection: 'bag', key: 'stacks', userId }]);
  return objs.length > 0 ? ((objs[0].value as { stacks?: { [d: string]: number } }).stacks || {}) : {};
}

function readRaw(nk: nkruntime.Nakama, userId: string, collection: string, key: string): unknown {
  const objs = nk.storageRead([{ collection, key, userId }]);
  return objs.length > 0 ? objs[0].value : null;
}

/** Every known definition: catch pool, recipes and what crafting makes. */
type DefRow = { id: string; category: Category; tier: Tier | null; waters?: string[]; bands?: Band[]; baits?: string[]; minLevel?: number; source: string; page: string | null };
function allDefs(): DefRow[] {
  const out: DefRow[] = [];
  const seen: { [id: string]: true } = {};
  const add = (d: ItemDef, source: string) => {
    if (seen[d.id]) return;
    seen[d.id] = true;
    out.push({ id: d.id, category: d.category, tier: tierOf(d.category), waters: d.waters, bands: d.bands, baits: d.baits, minLevel: d.minLevel, source, page: pageIdOf(BOOK_PAGES, d.id) });
  };
  for (const d of LAKE_POOL) add(d, 'lake');
  for (const r of RECIPES) {
    add({ id: r.id, category: 'recipe' }, 'recipe');
    // Stack outputs (bait) have no Tier and are not item definitions.
    if (!isStackOutput(r.output)) add({ id: r.output.defId, category: r.output.tier }, 'craft');
  }
  for (const p of BOOK_PAGES) for (const id of p.items) if (!seen[id]) out.push({ id, category: 'common', tier: null, source: 'book-only', page: p.id });
  return out;
}

/** Tier of a Float definition, or null if it stacks. */
function tierFor(defId: string): Tier | null | undefined {
  for (const d of allDefs()) if (d.id === defId) return d.tier;
  return undefined;
}

function categoryOf(defId: string): Category | null {
  for (const d of allDefs()) if (d.id === defId) return d.category;
  return null;
}

function gradeOf(defId: string) {
  const r = recipeById(defId);
  return r ? r.grade : null;
}

function rollFloatValue(): number {
  return rollFloat(FLOAT_TABLE, Math.random).value;
}

// --- RPCs ---

/** Everything static the dashboard needs: config, items, pages, recipes, the map. */
export function rpcDevInfo(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  devOnly(ctx);
  const map = buildCollisionMap(LAKE_MAP);
  const water = buildWaterMap(LAKE_MAP, WATER);
  const servers = SERVERS.map((s) => {
    const m = findWorldMatches(nk)[s.id];
    return { ...s, matchId: m ? m.matchId : null, players: m ? m.size : 0, capacity: WORLD.capacity };
  });
  return JSON.stringify({
    devTools: true,
    protocolVersion: PROTOCOL_VERSION,
    serverTime: Date.now(),
    node: ctx.node,
    opCodes: OpCode,
    config: { WORLD, USERNAME, WATER, FISHING, CATCH_TABLE, CATCH, FLOAT_TABLE, REEL_PARAMS, ENERGY, BAG, BOOK_LUCK, SCORE, PROFILE, EMOTES, FRIENDS, ECONOMY, CRAFT, XP },
    servers,
    defs: allDefs(),
    pages: BOOK_PAGES,
    recipes: RECIPES,
    starterRecipes: STARTER_RECIPES,
    map: {
      width: LAKE_MAP.width,
      height: LAKE_MAP.height,
      spawn: LAKE_MAP.spawn,
      rows: mapRows(LAKE_MAP.width, LAKE_MAP.height, (x, y) => !isWalkable(map, x, y), (x, y) => bandAt(water, x, y)),
      waters: water.names,
    },
  });
}

/** Accounts, newest first. `query` matches part of the username. */
export function rpcDevUsers(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const q = typeof body.query === 'string' ? body.query.slice(0, 32) : '';
  const limit = Math.min(200, Math.max(1, Number(body.limit) || 50));
  const rows = nk.sqlQuery(
    "SELECT id, username, create_time FROM users WHERE id <> '00000000-0000-0000-0000-000000000000' AND username ILIKE $1 ORDER BY create_time DESC LIMIT $2",
    ['%' + q + '%', limit],
  );
  const users = rows.map((r) => ({ userId: String(r.id), username: String(r.username), createTime: String(r.create_time) }));
  // Who is online and where.
  const where: { [id: string]: { serverName: string; x: number; y: number } } = {};
  for (const s of signalAll(nk, logger, { type: 'dev_state' })) {
    for (const p of s.players || []) where[p.userId] = { serverName: s.serverName, x: p.x, y: p.y };
  }
  return JSON.stringify({ users: users.map((u) => ({ ...u, online: where[u.userId] || null })) });
}

/** One player's whole state: account, wallet, bag, book, profile, raw storage, live match state. */
export function rpcDevPlayer(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const userId = target(ctx, nk, parse(payload));
  const account = nk.accountGetId(userId);
  const inventory = readInventory(nk, userId);
  const all = listItems(nk, userId);
  const entries = readBook(nk, userId);
  // Price preview for each bag item, through the same rule the NPC uses.
  const prices: { [instanceId: string]: { sell: number | null; dust: number | null; condition: string } } = {};
  for (const it of inventory.items) {
    const owned = { [it.instanceId]: { instanceId: it.instanceId, tier: it.tier, float: it.float } };
    const req = { items: [it.instanceId], stacks: [] };
    const s = planEconomy('sell', req, owned, {}, categoryOf, FLOAT_TABLE, ECONOMY, gradeOf);
    const d = planEconomy('salvage', req, owned, {}, categoryOf, FLOAT_TABLE, ECONOMY, gradeOf);
    prices[it.instanceId] = { sell: s.ok ? s.gained : null, dust: d.ok ? d.gained : null, condition: conditionName(it.float, FLOAT_TABLE) };
  }
  const stackPrices: { [defId: string]: { sell: number | null; dust: number | null } } = {};
  for (const st of inventory.stacks) {
    const stacks = { [st.defId]: 1 };
    const req = { items: [], stacks: [{ defId: st.defId, count: 1 }] };
    const s = planEconomy('sell', req, {}, stacks, categoryOf, FLOAT_TABLE, ECONOMY, gradeOf);
    const d = planEconomy('salvage', req, {}, stacks, categoryOf, FLOAT_TABLE, ECONOMY, gradeOf);
    stackPrices[st.defId] = { sell: s.ok ? s.gained : null, dust: d.ok ? d.gained : null };
  }
  const friends = nk.friendsList(userId, 100).friends || [];
  let ledger: unknown[] = [];
  try {
    ledger = (nk.walletLedgerList(userId, 25).items || []).map((l) => ({ changeset: l.changeset, metadata: l.metadata, createTime: l.createTime }));
  } catch (e) {
    logger.warn('ledger read failed: %s', String(e));
  }
  let livePlayer: Body | null = null;
  for (const s of signalAll(nk, logger, { type: 'dev_state' })) {
    for (const p of s.players || []) if (p.userId === userId) livePlayer = { ...p, serverName: s.serverName, matchId: s.matchId };
  }
  return JSON.stringify({
    userId,
    account: {
      username: account.user.username,
      displayName: account.user.displayName,
      createTime: account.user.createTime,
      devices: (account.devices || []).map((d) => d.id),
      wallet: account.wallet,
    },
    inventory,
    prices,
    stackPrices,
    bookItems: all.filter((i) => i.inBook).map(publicItem),
    itemsTotal: all.length,
    bookEntries: entries,
    book: JSON.parse(rpcGetBook(ctx, logger, nk, JSON.stringify({ userId }))),
    profile: JSON.parse(rpcGetProfile(ctx, logger, nk, JSON.stringify({ userId }))),
    profileDoc: readProfile(nk, userId),
    energyDoc: readRaw(nk, userId, 'player', 'energy'),
    position: readRaw(nk, userId, 'player', 'position'),
    friends: friends.map((f) => ({ userId: f.user!.userId, username: f.user!.username, state: f.state, online: f.user!.online })),
    ledger,
    live: livePlayer,
  });
}

/**
 * Gives items. Float items: `count` copies (max 40), `float` fixed or rolled, `tier`
 * from the definition (or given for an unknown id). `bag: true` skips the book's
 * first-copy rule. Stack items: `count` added to the stack.
 */
export function rpcDevGive(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const defId = String(body.defId || '');
  if (!defId || defId.length > 64) throw fail('defId missing');
  const count = Math.max(1, Math.min(Number(body.count) || 1, 999));
  let tier = tierFor(defId);
  if (typeof body.tier === 'string') {
    if (TIERS.indexOf(body.tier as Tier) < 0) throw fail('bad tier');
    tier = body.tier as Tier;
  }
  if (tier === undefined) throw fail('unknown defId; pass tier to give it anyway');

  const given: ItemInstance[] = [];
  const book: unknown[] = [];
  if (tier === null) {
    const stacks = readStacks(nk, userId);
    stacks[defId] = (stacks[defId] || 0) + count;
    nk.storageWrite([stacksWrite(userId, stacks)]);
  } else {
    let entries: BookEntries = readBook(nk, userId);
    for (let i = 0; i < Math.min(count, 40); i++) {
      const f = typeof body.float === 'number' ? Math.max(0, Math.min(0.9999, body.float)) : rollFloatValue();
      const item: ItemInstance = { instanceId: nk.uuidv4(), defId, tier, float: f, source: body.source === 'craft' || body.source === 'merge' ? body.source : 'fishing', obtainedAt: Date.now() };
      if (body.bag) {
        nk.storageWrite([itemWrite(userId, item)]);
      } else {
        const placed = placeNewItem(userId, entries, item);
        nk.storageWrite(placed.writes);
        if (placed.book) entries = placed.book;
        if (placed.msg) book.push(placed.msg);
      }
      given.push(item);
    }
  }
  const live = reload(nk, logger, userId);
  return JSON.stringify({ ok: true, given, book, stack: tier === null ? { defId, count } : undefined, live });
}

/** Changes an item's Float, Tier or place (bag / book flag). */
export function rpcDevItemEdit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const item = readItem(nk, userId, String(body.instanceId || ''));
  if (!item) throw fail('no such item', 5);
  if (typeof body.float === 'number') item.float = Math.max(0, Math.min(0.9999, body.float));
  if (typeof body.tier === 'string') {
    if (TIERS.indexOf(body.tier as Tier) < 0) throw fail('bad tier');
    item.tier = body.tier as Tier;
  }
  const writes = [itemWrite(userId, item)];
  // Keep the book's slot copy in step, so score and "better" checks see the new values.
  if (item.inBook) {
    const entries = readBook(nk, userId);
    const e = entries[item.defId];
    if (e && e.slot && e.slot.instanceId === item.instanceId) {
      e.slot = { instanceId: item.instanceId, tier: item.tier, float: item.float };
      writes.push(bookWrite(userId, entries));
    }
  }
  nk.storageWrite(writes);
  return JSON.stringify({ ok: true, item: publicItem(item), live: reload(nk, logger, userId) });
}

/** Deletes items from the bag or book (`instanceIds`), or every bag item with `all: true`. */
export function rpcDevItemDelete(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const items = listItems(nk, userId);
  const ids: string[] = body.all ? items.filter((i) => !i.inBook).map((i) => i.instanceId) : Array.isArray(body.instanceIds) ? body.instanceIds.map(String) : [];
  const entries = readBook(nk, userId);
  let bookChanged = false;
  for (const id of ids) {
    const it = items.filter((i) => i.instanceId === id)[0];
    if (it && it.inBook && entries[it.defId] && entries[it.defId].slot && entries[it.defId].slot!.instanceId === id) {
      delete entries[it.defId].slot;
      bookChanged = true;
    }
  }
  if (ids.length > 0) nk.storageDelete(ids.map((key) => ({ collection: 'items', key, userId })));
  if (bookChanged) nk.storageWrite([bookWrite(userId, entries)]);
  return JSON.stringify({ ok: true, deleted: ids.length, live: reload(nk, logger, userId) });
}

/** Sets stack counts: `{ stacks: { defId: count } }`, 0 removes; `clear: true` empties every stack first. */
export function rpcDevStacks(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const stacks = body.clear ? {} : readStacks(nk, userId);
  const changes = typeof body.stacks === 'object' && body.stacks !== null ? body.stacks : {};
  for (const defId in changes) {
    const n = Math.floor(Number(changes[defId]));
    if (!isFinite(n) || n < 0) throw fail('bad count for ' + defId);
    if (n === 0) delete stacks[defId];
    else stacks[defId] = n;
  }
  nk.storageWrite([stacksWrite(userId, stacks)]);
  return JSON.stringify({ ok: true, stacks, live: reload(nk, logger, userId) });
}

/** Coin and dust: `set: { coin?, dust? }` or `add: { coin?, dust? }`. Written to the ledger as dev. */
export function rpcDevWallet(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const now = readWallet(nk, userId);
  const change: { [k: string]: number } = {};
  for (const k of ['coin', 'dust'] as const) {
    if (body.set && typeof body.set[k] === 'number') change[k] = Math.max(0, Math.floor(body.set[k])) - now[k];
    else if (body.add && typeof body.add[k] === 'number') change[k] = Math.max(-now[k], Math.floor(body.add[k]));
  }
  if (Object.keys(change).length === 0) throw fail('nothing to change');
  const res = nk.walletUpdate(userId, change, { action: 'dev', by: ctx.userId || 'http_key' }, true);
  return JSON.stringify({ ok: true, wallet: res.updated, previous: res.previous });
}

/** Energy: `{ value }`. Online players get it in the match at once. */
export function rpcDevEnergy(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const value = Number(body.value);
  if (!isFinite(value) || value < 0 || value > 100000) throw fail('bad value');
  const live = signalPlayer(nk, logger, { type: 'dev_energy', userId, value });
  // Offline: saved as offline, so refill starts counting from now.
  if (!live) nk.storageWrite([energyWrite(userId, value, false)]);
  return JSON.stringify({ ok: true, energy: live ? live.energy : currentEnergy(nk, userId), live: !!live });
}

/** Sets a player's total XP (live match player if online, else storage). `level` sets the level's starting XP instead. */
export function rpcDevXp(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  let total = Number(body.value);
  if (body.level !== undefined) total = totalForLevel(Number(body.level), XP);
  if (!isFinite(total) || total < 0 || total > 100_000_000) throw fail('bad value');
  const live = signalPlayer(nk, logger, { type: 'dev_xp', userId, value: total });
  if (!live) nk.storageWrite([xpWrite(userId, Math.floor(total))]);
  return JSON.stringify({ ok: true, ...levelOf(Math.floor(total), XP), total: Math.floor(total), live: !!live });
}

/**
 * Book edits: `action` is one of
 *   discover  (defId)  record found, slot empty
 *   fill      (defId)  record filled with a new item (float optional)
 *   unslot    (defId)  slot item goes back to the bag
 *   forget    (defId)  record removed, slot item goes back to the bag
 *   fill_page (page)   every record on the page filled
 *   reset              every record removed, slot items go back to the bag
 */
export function rpcDevBook(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const action = String(body.action || '');
  let entries = readBook(nk, userId);
  const writes: nkruntime.StorageWriteRequest[] = [];
  const toBag = (defId: string) => {
    const slot = entries[defId] && entries[defId].slot;
    if (!slot) return;
    const it = readItem(nk, userId, slot.instanceId);
    if (it) writes.push(itemWrite(userId, publicItem(it)));
    delete entries[defId].slot;
  };
  const fill = (defId: string, float?: number) => {
    const tier = tierFor(defId);
    if (!tier) throw fail(defId + ' is not a Float item');
    toBag(defId);
    const item: ItemInstance = { instanceId: nk.uuidv4(), defId, tier, float: typeof float === 'number' ? float : rollFloatValue(), source: 'fishing', obtainedAt: Date.now() };
    writes.push(itemWrite(userId, { ...item, inBook: true }));
    entries[defId] = { foundAt: entries[defId] ? entries[defId].foundAt : Date.now(), slot: { instanceId: item.instanceId, tier, float: item.float } };
  };
  const defId = String(body.defId || '');
  const needDef = () => {
    if (!pageIdOf(BOOK_PAGES, defId)) throw fail('defId is not on any book page');
  };
  entries = { ...entries };
  if (action === 'discover') {
    needDef();
    if (!entries[defId]) entries[defId] = { foundAt: Date.now() };
  } else if (action === 'fill') {
    needDef();
    fill(defId, typeof body.float === 'number' ? body.float : undefined);
  } else if (action === 'unslot') {
    needDef();
    toBag(defId);
  } else if (action === 'forget') {
    needDef();
    toBag(defId);
    delete entries[defId];
  } else if (action === 'fill_page') {
    const page = BOOK_PAGES.filter((p) => p.id === body.page)[0];
    if (!page) throw fail('no such page');
    for (const id of page.items) if (!(entries[id] && entries[id].slot)) fill(id);
  } else if (action === 'reset') {
    for (const id in entries) toBag(id);
    entries = {};
  } else {
    throw fail('unknown action');
  }
  writes.push(bookWrite(userId, entries));
  nk.storageWrite(writes);
  return JSON.stringify({
    ok: true,
    luck: luckOf(entries, BOOK_PAGES, BOOK_LUCK),
    score: scoreOf(entries, BOOK_PAGES, SCORE),
    live: reload(nk, logger, userId),
  });
}

/** Writes the profile card without the game's checks (to test what clients show for odd data). */
export function rpcDevProfile(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const doc = readProfile(nk, userId);
  if (Array.isArray(body.showcase)) doc.showcase = body.showcase.map(String).slice(0, 10);
  if (body.hunting === null) doc.hunting = undefined;
  else if (typeof body.hunting === 'string') doc.hunting = body.hunting;
  nk.storageWrite([profileWrite(userId, doc)]);
  return JSON.stringify({ ok: true, profile: doc });
}

/** Friendships between two players: `action` befriend (mutual at once), remove, or block. */
export function rpcDevFriends(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const a = String(body.a || '');
  const b = String(body.b || '');
  if (!UUID.test(a) || !UUID.test(b) || a === b) throw fail('a and b must be two user ids');
  const users = nk.usersGetId([a, b]);
  if (users.length !== 2) throw fail('no such user', 5);
  const ua = users.filter((u) => u.userId === a)[0];
  const ub = users.filter((u) => u.userId === b)[0];
  const action = String(body.action || 'befriend');
  if (action === 'befriend') {
    nk.friendsAdd(a, ua.username, [b], [], {});
    nk.friendsAdd(b, ub.username, [a], [], {});
  } else if (action === 'request') {
    nk.friendsAdd(a, ua.username, [b], [], {});
  } else if (action === 'remove') {
    nk.friendsDelete(a, ua.username, [b], []);
  } else if (action === 'block') {
    nk.friendsBlock(a, ua.username, [b], []);
  } else {
    throw fail('unknown action');
  }
  const list = (nk.friendsList(a, 100).friends || []).map((f) => ({ userId: f.user!.userId, username: f.user!.username, state: f.state }));
  return JSON.stringify({ ok: true, friends: list });
}

/** Wipes a player's game data and wallet and gives the starter recipes again, like a new account. */
export function rpcDevReset(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const deletes: nkruntime.StorageDeleteRequest[] = [];
  for (const collection of PLAYER_COLLECTIONS) {
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 50; page++) {
      const res: nkruntime.StorageObjectList = nk.storageList(userId, collection, 100, cursor);
      for (const o of res.objects || []) deletes.push({ collection, key: o.key, userId });
      cursor = res.cursor;
      if (!cursor) break;
    }
  }
  if (deletes.length > 0) nk.storageDelete(deletes);
  const stacks: { [defId: string]: number } = {};
  for (const s of STARTER_RECIPES) stacks[s.defId] = s.count;
  nk.storageWrite([stacksWrite(userId, stacks)]);
  const w = readWallet(nk, userId);
  if (w.coin !== 0 || w.dust !== 0) nk.walletUpdate(userId, { coin: -w.coin, dust: -w.dust }, { action: 'dev_reset' }, true);
  // An online player keeps standing where they are; energy goes back to full.
  const live = signalPlayer(nk, logger, { type: 'dev_energy', userId, value: ENERGY.max });
  reload(nk, logger, userId);
  return JSON.stringify({ ok: true, deleted: deletes.length, live: !!live });
}

/** Live state of every world match: who is in, where, fishing phase, cached bag. */
export function rpcDevWorld(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  devOnly(ctx);
  return JSON.stringify({ servers: signalAll(nk, logger, { type: 'dev_state' }) });
}

/**
 * Pokes a live player through their match: `action` is
 *   teleport { x, y, force? }   move them (TELEPORT is sent)
 *   bite_now                    the waiting bobber bites on the next tick
 *   force { defId, windowMs? }  the bobber bites now with this catch
 *   twitch                      a fake twitch
 *   cancel                      ends fishing as cancelled
 *   push { op, body }           send any server message to this player
 *   push_all { op, body }       send it to everyone in every match
 *   kick                        drop them from the match
 */
export function rpcDevLive(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const action = String(body.action || '');
  if (action === 'push_all') {
    return JSON.stringify({ ok: true, results: signalAll(nk, logger, { type: 'dev_push_all', op: Number(body.op), body: body.body }) });
  }
  const userId = target(ctx, nk, body);
  let msg: { type: string; userId: string; [k: string]: unknown };
  if (action === 'teleport') msg = { type: 'dev_teleport', userId, x: body.x, y: body.y, force: !!body.force };
  else if (action === 'push') msg = { type: 'dev_push', userId, op: Number(body.op), body: body.body };
  else if (action === 'kick') msg = { type: 'dev_kick', userId };
  else msg = { type: 'dev_fish', userId, action, defId: body.defId, windowMs: body.windowMs };
  const r = signalPlayer(nk, logger, msg);
  if (!r) throw fail('player is not in any world match', 5);
  if (r.error) throw fail(String(r.error));
  return JSON.stringify(r);
}

/**
 * Rolls the catch table many times: `{ n, band, water?, level?, hasEnergy, luck }`
 * or the player's own luck via `userId`. Band weights (CATCH) are included.
 */
export function rpcDevSimCatch(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const n = Math.max(1, Math.min(Number(body.n) || 10000, 200000));
  const band = (BANDS.indexOf(body.band) >= 0 ? body.band : 'deep') as Band;
  let luck = typeof body.luck === 'number' ? Math.max(0, Math.min(body.luck, 5)) : 0;
  if (typeof body.userId === 'string' && UUID.test(body.userId)) luck = luckOf(readBook(nk, body.userId), BOOK_PAGES, BOOK_LUCK);
  const water = typeof body.water === 'string' && body.water ? body.water : null;
  const level = typeof body.level === 'number' && isFinite(body.level) ? Math.max(1, Math.floor(body.level)) : LEVEL.start;
  const spot = { band, water, level };
  const res = simulateCatches(LAKE_POOL, CATCH_TABLE, spot, body.hasEnergy !== false, luck, BOOK_LUCK, FLOAT_TABLE, n, Math.random, CATCH);
  return JSON.stringify({ ...res, band, water, level, luck });
}

/**
 * The reel mini game: `{ seed?, tier | params, band?, inputs? }`. `band` applies
 * that band's difficulty (FISHING.reel) to the Tier's params, as a real bite does. Without inputs it plays
 * itself (`lose: true` to lose on purpose) and returns inputs for REEL_DONE.
 */
export function rpcDevReel(ctx: nkruntime.Context, _logger: nkruntime.Logger, _nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const tier = (TIERS.indexOf(body.tier) >= 0 ? body.tier : 'common') as Tier;
  const tierParams = BANDS.indexOf(body.band) >= 0 ? reelParamsFor(REEL_PARAMS[tier], body.band as Band, FISHING) : REEL_PARAMS[tier];
  const params = typeof body.params === 'object' && body.params !== null ? { ...tierParams, ...body.params } : tierParams;
  const seed = typeof body.seed === 'number' ? body.seed >>> 0 : Math.floor(Math.random() * 4294967296);
  if (Array.isArray(body.inputs)) {
    const r = simulateReel(seed, params, body.inputs.map(Number));
    return JSON.stringify({ seed, params, inputs: body.inputs, ...r, minMs: r.steps * 20 });
  }
  const sol = solveReel(seed, params, !!body.lose);
  return JSON.stringify({ seed, params, ...sol, minMs: sol.steps * 20 });
}

/** Craft quality: the Float bands a result rolls from, for an input average and recipe grade. */
export function rpcDevCraftPreview(ctx: nkruntime.Context, _logger: nkruntime.Logger, _nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const avg = typeof body.average === 'number' ? body.average : null;
  const recipe = typeof body.recipeId === 'string' ? recipeById(body.recipeId) : null;
  const grade = recipe ? recipe.grade : body.grade === 'good' || body.grade === 'master' ? body.grade : 'normal';
  const maxFloat = CRAFT.gradeMaxFloat[grade as 'normal' | 'good' | 'master'];
  return JSON.stringify({
    grade,
    maxFloat,
    row: qualityRow(avg, CRAFT),
    bands: craftBands(FLOAT_TABLE, avg, maxFloat, CRAFT),
    mergeDust: CRAFT.mergeDust,
    craftDust: CRAFT.craftDust,
    recipe,
  });
}

/** A player's trade and stall log, newest first, plus reports about them and by them (moderation view). */
export function rpcDevTrades(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  devOnly(ctx);
  const body = parse(payload);
  const userId = target(ctx, nk, body);
  const limit = Math.max(1, Math.min(500, Math.floor(Number(body.limit) || 100)));
  const all = (owner: string, collection: string, max: number) => {
    const out: nkruntime.StorageObject[] = [];
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 50 && out.length < max; page++) {
      const res: nkruntime.StorageObjectList = nk.storageList(owner, collection, 100, cursor);
      for (const o of res.objects || []) out.push(o);
      cursor = res.cursor;
      if (!cursor) break;
    }
    return out;
  };
  const trades = all(userId, 'trades', 5000)
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
    .slice(0, limit)
    .map((o) => o.value);
  const reports = all(SYSTEM_USER, 'reports', 5000).map((o) => o.value as { target?: string; reporter?: string });
  const flagObj = nk.storageRead([{ collection: 'bot_flags', key: userId, userId: SYSTEM_USER }]);
  return JSON.stringify({
    userId,
    botFlags: flagObj.length > 0 ? (flagObj[0].value as { flags?: unknown }).flags || {} : {},
    trades,
    reportsAbout: reports.filter((r) => r.target === userId),
    reportsBy: reports.filter((r) => r.reporter === userId),
  });
}

/** Every player with a bot flag, most recently flagged first. */
export function rpcDevFlags(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  devOnly(ctx);
  const out: { userId: string; name: string; flags: { [f: string]: { at: number } }; lastAt: number }[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 50; page++) {
    const res: nkruntime.StorageObjectList = nk.storageList(SYSTEM_USER, 'bot_flags', 100, cursor);
    for (const o of res.objects || []) {
      const v = o.value as { userId: string; name: string; flags: { [f: string]: { at: number } } };
      const lastAt = Math.max(0, ...Object.keys(v.flags || {}).map((k) => v.flags[k].at || 0));
      out.push({ userId: v.userId, name: v.name, flags: v.flags || {}, lastAt });
    }
    cursor = res.cursor;
    if (!cursor) break;
  }
  out.sort((a, b) => b.lastAt - a.lastAt);
  return JSON.stringify({ players: out });
}
