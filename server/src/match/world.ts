// One server = one authoritative match on the shared map (docs/mimari.md).
// Thin layer: every decision is made by the pure functions in rules/.
import { ACCOUNT_DELETE, EMOTES, ENERGY, FRIENDS, MARKET, MODERATION, ROD, SERVERS, SPAWN_TELEPORT, WATCH, WATER, WHISPER, WORLD, XP } from '../config';
import { LAKE_MAP, MARKET_POINT } from '../data/lake-map';
import { getContent, invalidateContent } from './content';
import {
  BubbleMsg,
  CorrectionMsg,
  Dir,
  EmoteShowMsg,
  EmoteStatusShowMsg,
  OpCode,
  PlayerEnterMsg,
  PlayerLeaveMsg,
  PlayerView,
  SnapshotMsg,
  TeleportMsg,
  WelcomeMsg,
} from '../protocol';
import { canSpeak, sanitizeChat } from '../rules/chat';
import { maskPersonal } from '../rules/whisper';
import { checkJoin } from '../rules/join';
import { buildSpots } from '../rules/market';
import { buildCollisionMap, CollisionMap, isWalkable, randomSpotInArea, spotNear } from '../rules/map';
import { levelOf } from '../rules/xp';
import { canEmote, canWear, parseEmote, parseStatus } from '../rules/emote';
import { areFriends } from './friends';
import { applyMove, MoveState, newMoveState, parseMove } from '../rules/movement';
import { SpatialGrid, updateVisibility } from '../rules/proximity';
import { buildWaterMap, WaterMap } from '../rules/water';
import { BagSummary } from '../rules/bag';
import { QuestState } from '../rules/quest';
import { FishState } from '../rules/fishing';
import { Fisher, FishingContext, cancelFishing, flushEnergy, handleCast, handleHook, handleReelDone, tickFishing } from './fishing';
import { handleItemLock } from './lock';
import { handleItemDiscard } from './discard';
import { handleQuestClaim, loadQuestState, rollQuestDay, sendQuests, trackQuest } from './quest';
import { MarketEnv, MarketState, handleStallOp, initMarket, ownerLeft, sendBoard, sendStalls, settleEnded, tickMarket } from './market';
import { TradeEnv, TradeRec, cancelTradeOf, handleTradeOp, tickTrades } from './trade';
import { currentEnergy, energyWrite, loadBag, readBook, readEmotes, readMutedUntil, readRod, readXp, sessionWrite, statusEmoteWrite } from './playerData';
import { handleBookPlace } from './book';
import { handleCraft } from './craft';
import { handleEconomy } from './economy';
import { handleShop } from './shop';
import { StashAction, StashCache, handleStash } from './stash';
import { Rod, rodView } from '../rules/rod';
import { BookEntries } from '../rules/book';
import { WorldLabel } from './servers';
import { devSignal } from '../debug/signal';
import { sweepDeletions } from '../rpc/accountDelete';
import { WatchStats, changeMark, recordChat } from '../rules/watch';
import { readWatch, saveWatch } from './watch';

export const POSITION_COLLECTION = 'player';
export const POSITION_KEY = 'position';

interface Player {
  presence: nkruntime.Presence;
  name: string;
  characterId: string;
  dir: Dir;
  moving: boolean;
  move: MoveState;
  lastSpokeAt?: number;
  /** Muted (wall-clock ms) until; re-read from storage now and then while the player talks. */
  mutedUntil: number;
  muteCheckedAt: number;
  /** Ids this player currently sees. */
  visible: { [id: string]: true };
  /** Changed since the last SNAPSHOT. */
  dirty: boolean;
  energy: number;
  /** Cast energy not saved yet. */
  energyDirty?: boolean;
  bag: BagSummary;
  book: BookEntries;
  rod: Rod;
  /** Total XP; the level comes from it. */
  xp: number;
  /** Today's quests, the streak and the last claimed day. */
  quest?: QuestState;
  /** Loaded the first time the stash is used at the bank. */
  stash?: StashCache;
  fish?: FishState;
  /** Last thing caught, for the show_fish emote. */
  lastCatch?: string;
  lastEmoteAt?: number;
  /** Status emote worn above the head; kept in storage. */
  status?: string;
  /** Non-free status emotes this player owns. */
  emotesOwned: string[];
  lastStatusAt?: number;
  /** The trade this player is in (invite or open window). */
  tradeId?: string;
  lastOfferAt?: number;
  lastTeleportAt?: number;
  /** Last GOTO_SPAWN ("Başlangıca dön"), for its own longer cooldown. */
  lastSpawnTeleportAt?: number;
  /** Bot signals (rules/watch.ts), saved every WATCH.flushMs and on leave. */
  watch: WatchStats;
  watchSavedAt: number;
  watchMark?: string;
}

/** Join metadata accepted in matchJoinAttempt. */
interface PendingJoin {
  characterId: string;
  /** "Yanına git": land next to this friend if they are here. */
  near?: string;
}

export interface WorldState {
  serverId: string;
  serverName: string;
  /** Kept in state, not a global: Nakama makes globals read-only. */
  map: CollisionMap;
  water: WaterMap;
  players: { [userId: string]: Player };
  /** Join metadata accepted in matchJoinAttempt, keyed by session. */
  pending: { [sessionId: string]: PendingJoin };
  /** Trade sessions between players of this server. */
  trades: { [tradeId: string]: TradeRec };
  /** Pet stalls standing in this server. */
  market: MarketState;
  /** Wall-clock ms of the last account deletion sweep (only the first server sweeps). */
  sweptAt: number;
  /** Wall-clock ms of the last energy save (ENERGY.saveEveryMs). */
  energySavedAt: number;
}

const tickMs = 1000 / WORLD.tickRate;

const STASH_OPS: { [op: number]: StashAction } = {
  [OpCode.STASH_OPEN]: 'open',
  [OpCode.STASH_PUT]: 'put',
  [OpCode.STASH_TAKE]: 'take',
  [OpCode.STASH_EXPAND]: 'expand',
};
const moveCfg = WORLD;

function send(dispatcher: nkruntime.MatchDispatcher, op: number, body: unknown, to: nkruntime.Presence[]): void {
  if (to.length > 0) dispatcher.broadcastMessage(op, JSON.stringify(body), to, null, true);
}

function view(id: string, p: Player): PlayerView {
  return { id, x: p.move.x, y: p.move.y, dir: p.dir, moving: p.moving };
}

function readPositions(nk: nkruntime.Nakama, userIds: string[]): { [userId: string]: { x: number; y: number } } {
  const out: { [userId: string]: { x: number; y: number } } = {};
  if (userIds.length === 0) return out;
  const objs = nk.storageRead(userIds.map((userId) => ({ collection: POSITION_COLLECTION, key: POSITION_KEY, userId })));
  for (const o of objs) {
    const v = o.value as { x?: unknown; y?: unknown };
    if (typeof v.x === 'number' && typeof v.y === 'number') out[o.userId] = { x: v.x, y: v.y };
  }
  return out;
}

function saveEnergy(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, value: number, online: boolean): void {
  try {
    nk.storageWrite([energyWrite(userId, value, online)]);
  } catch (e) {
    logger.error('Saving energy failed: %s', String(e));
  }
}

function savePositions(nk: nkruntime.Nakama, logger: nkruntime.Logger, players: Player[]): void {
  if (players.length === 0) return;
  try {
    nk.storageWrite(
      players.map((p) => ({
        collection: POSITION_COLLECTION,
        key: POSITION_KEY,
        userId: p.presence.userId,
        value: { x: p.move.x, y: p.move.y },
        permissionRead: 1 as nkruntime.ReadPermissionValues,
        permissionWrite: 0 as nkruntime.WritePermissionValues,
      })),
    );
  } catch (e) {
    logger.error('Saving positions failed: %s', String(e));
  }
}

export function worldInit(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: any },
): { state: WorldState; tickRate: number; label: string } {
  const serverId = String(params.serverId);
  const def = SERVERS.filter((s) => s.id === serverId)[0];
  const label: WorldLabel = { kind: 'world', serverId };
  const map = buildCollisionMap(LAKE_MAP);
  const spots = buildSpots(MARKET_POINT, MARKET, (x, y) => isWalkable(map, x, y));
  return {
    state: {
      serverId,
      serverName: def ? def.name : serverId,
      map,
      water: buildWaterMap(LAKE_MAP, WATER),
      players: {},
      pending: {},
      trades: {},
      market: initMarket(nk, logger, serverId, spots),
      sweptAt: 0,
      energySavedAt: Date.now(),
    },
    tickRate: WORLD.tickRate,
    label: JSON.stringify(label),
  };
}

export function worldJoinAttempt(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: WorldState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any },
): { state: WorldState; accept: boolean; rejectMessage?: string } {
  let count = 0;
  for (const id in state.players) if (id !== presence.userId) count++;
  const check = checkJoin(metadata, count, WORLD.capacity);
  if (!check.ok) return { state, accept: false, rejectMessage: check.error };
  const near = typeof metadata.near === 'string' && metadata.near.length <= 64 ? metadata.near : undefined;
  state.pending[presence.sessionId] = { characterId: check.characterId, near };
  return { state, accept: true };
}

export function worldJoin(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: WorldState,
  presences: nkruntime.Presence[],
): { state: WorldState } | null {
  getContent(nk, logger);
  const map = state.map;
  const now = tick * tickMs;
  const fresh = presences.filter((p) => !state.players[p.userId]).map((p) => p.userId);
  const saved = readPositions(nk, fresh);

  for (const presence of presences) {
    const pending = state.pending[presence.sessionId];
    const characterId = pending ? pending.characterId : 'default';
    delete state.pending[presence.sessionId];

    const old = state.players[presence.userId];
    let x = map.spawn.x;
    let y = map.spawn.y;
    if (old) {
      // Same account from a new connection: keep its place, drop the old one.
      x = old.move.x;
      y = old.move.y;
      if (old.presence.sessionId !== presence.sessionId) dispatcher.matchKick([old.presence]);
    } else if (saved[presence.userId] && isWalkable(map, saved[presence.userId].x, saved[presence.userId].y)) {
      x = saved[presence.userId].x;
      y = saved[presence.userId].y;
    }
    // "Yanına git" from another server: land beside the friend if they are here.
    if (pending && pending.near && state.players[pending.near] && areFriends(nk, presence.userId, pending.near)) {
      const f = state.players[pending.near].move;
      const spot = spotNear(map, f.x, f.y, FRIENDS.landRadius, FRIENDS.landMinDistance);
      if (spot) {
        x = spot.x;
        y = spot.y;
      }
    }

    // A stall that ended while the owner was away comes home before the bag is loaded.
    if (!old) settleEnded(nk, logger, presence.userId);
    // A reconnect keeps the live energy and bag; a fresh join loads them.
    const energy = old ? old.energy : currentEnergy(nk, presence.userId);
    const bag = old ? old.bag : loadBag(nk, presence.userId);
    const book = old ? old.book : readBook(nk, presence.userId);
    const rod = old ? old.rod : readRod(nk, presence.userId);
    const xp = old ? old.xp : readXp(nk, presence.userId);
    const emotes = old ? { status: old.status, owned: old.emotesOwned } : readEmotes(nk, presence.userId);
    const watch = old ? old.watch : readWatch(nk, presence.userId);
    if (!old) {
      saveEnergy(nk, logger, presence.userId, energy, true);
      try {
        nk.storageWrite([sessionWrite(presence.userId, state.serverId)]);
      } catch (e) {
        logger.error('Saving session failed: %s', String(e));
      }
    }

    state.players[presence.userId] = {
      presence,
      name: presence.username,
      characterId,
      dir: old ? old.dir : 'down',
      moving: false,
      move: newMoveState(x, y, now, moveCfg),
      visible: {},
      dirty: true,
      energy,
      energyDirty: old ? old.energyDirty : false,
      bag,
      book,
      rod,
      xp,
      status: emotes.status,
      emotesOwned: emotes.owned,
      mutedUntil: old ? old.mutedUntil : readMutedUntil(nk, presence.userId),
      muteCheckedAt: old ? old.muteCheckedAt : Date.now(),
      quest: old ? old.quest : loadQuestState(nk, logger, presence.userId, xp, Date.now()),
      tradeId: old ? old.tradeId : undefined,
      lastOfferAt: old ? old.lastOfferAt : undefined,
      stash: old ? old.stash : undefined,
      watch,
      watchSavedAt: old ? old.watchSavedAt : now,
      // What storage already holds, so a player who only stands around never writes.
      watchMark: old ? old.watchMark : changeMark(watch),
    };
    const lv = levelOf(xp, XP);
    const welcome: WelcomeMsg = { you: { id: presence.userId, x, y }, serverName: state.serverName, energy, energyMax: ENERGY.max, rod: rodView(rod, ROD), emotesOwned: emotes.owned, level: lv.level, xp: lv.xp, xpNext: lv.xpNext };
    if (emotes.status) welcome.status = emotes.status;
    send(dispatcher, OpCode.WELCOME, welcome, [presence]);
    sendStalls(marketEnv(nk, logger, dispatcher, state), presence);
    sendBoard(marketEnv(nk, logger, dispatcher, state), presence);
    sendQuests(dispatcher, state.players[presence.userId], Date.now());
  }
  return { state };
}

export function worldLeave(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: WorldState,
  presences: nkruntime.Presence[],
): { state: WorldState } | null {
  const gone: Player[] = [];
  for (const presence of presences) {
    delete state.pending[presence.sessionId];
    const p = state.players[presence.userId];
    // A kicked old connection must not remove the new one.
    if (!p || p.presence.sessionId !== presence.sessionId) continue;
    gone.push(p);
    delete state.players[presence.userId];
    cancelTradeOf(tradeEnv(nk, logger, dispatcher, state), presence.userId);
    ownerLeft(marketEnv(nk, logger, dispatcher, state), p);
    saveEnergy(nk, logger, presence.userId, p.energy, false);
    const msg: PlayerLeaveMsg = { id: presence.userId };
    const watchers: nkruntime.Presence[] = [];
    for (const id in state.players) {
      const other = state.players[id];
      if (other.visible[presence.userId]) {
        delete other.visible[presence.userId];
        watchers.push(other.presence);
      }
    }
    send(dispatcher, OpCode.PLAYER_LEAVE, msg, watchers);
  }
  savePositions(nk, logger, gone);
  saveWatch(nk, logger, gone, tick * tickMs);
  return { state };
}

/** Returns true if the player actually changed position. */
function handleMove(dispatcher: nkruntime.MatchDispatcher, map: CollisionMap, p: Player, body: unknown, now: number): boolean {
  const intent = parseMove(body);
  if (!intent) return false;
  const res = applyMove(p.move, intent, now, moveCfg, map);
  if (res.kind === 'ignore') return false;
  const moved = res.state.x !== p.move.x || res.state.y !== p.move.y;
  p.move = res.state;
  if (res.kind === 'reject') {
    const fix: CorrectionMsg = { seq: intent.seq, x: res.state.x, y: res.state.y };
    send(dispatcher, OpCode.CORRECTION, fix, [p.presence]);
    return false;
  }
  p.dir = intent.dir;
  p.moving = intent.moving;
  p.dirty = true;
  return moved;
}

function fishingContext(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, state: WorldState): FishingContext {
  return {
    nk,
    logger,
    dispatcher,
    water: state.water,
    everyone: () => Object.keys(state.players).map((id) => state.players[id].presence),
    audience: (f: Fisher) => {
      const out = [f.presence];
      for (const id in state.players) {
        if (state.players[id].visible[f.presence.userId]) out.push(state.players[id].presence);
      }
      return out;
    },
  };
}

function handleSay(
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  state: WorldState,
  grid: SpatialGrid,
  p: Player,
  body: unknown,
  now: number,
): void {
  const text = sanitizeChat(typeof body === 'object' && body !== null ? (body as { text?: unknown }).text : null);
  if (text === null || !canSpeak(p.lastSpokeAt, now)) return;
  p.lastSpokeAt = now;
  recordChat(p.watch);
  const wall = Date.now();
  if (wall - p.muteCheckedAt >= MODERATION.muteRecheckMs) {
    p.muteCheckedAt = wall;
    try {
      p.mutedUntil = readMutedUntil(nk, p.presence.userId);
    } catch (_e) {
      // Keep the cached value if storage is briefly unavailable.
    }
  }
  if (p.mutedUntil > wall) return;
  const to = grid.near(p.move.x, p.move.y, WORLD.chatRadius).map((q) => state.players[q.id].presence);
  const msg: BubbleMsg = { id: p.presence.userId, text: maskPersonal(text, WHISPER).text };
  send(dispatcher, OpCode.BUBBLE, msg, to);
}

/** GOTO_FRIEND inside this server: moves the player next to a friend who is here. */
function handleGotoFriend(
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  fishing: FishingContext,
  state: WorldState,
  p: Player,
  body: unknown,
  now: number,
): void {
  const refuse = (reason: string) => {
    const msg: TeleportMsg = { x: p.move.x, y: p.move.y, reason };
    send(dispatcher, OpCode.TELEPORT, msg, [p.presence]);
  };
  const friendId = typeof body === 'object' && body !== null ? (body as { userId?: unknown }).userId : undefined;
  if (typeof friendId !== 'string' || friendId === p.presence.userId) return refuse('NOT_FRIEND');
  if (p.lastTeleportAt !== undefined && now - p.lastTeleportAt < FRIENDS.teleportCooldownMs) return refuse('RATE_LIMITED');
  p.lastTeleportAt = now;
  const friend = state.players[friendId];
  if (!friend) return refuse('NOT_HERE');
  if (!areFriends(nk, p.presence.userId, friendId)) return refuse('NOT_FRIEND');
  const spot = spotNear(state.map, friend.move.x, friend.move.y, FRIENDS.landRadius, FRIENDS.landMinDistance);
  if (!spot) return refuse('NO_SPOT');
  cancelFishing(fishing, p);
  p.move = newMoveState(spot.x, spot.y, now, moveCfg);
  p.moving = false;
  p.dirty = true;
  const msg: TeleportMsg = { x: spot.x, y: spot.y };
  send(dispatcher, OpCode.TELEPORT, msg, [p.presence]);
}

/** BOARD_GOTO: a click on an ad moves the player next to the advertised stall (this server only). */
function handleBoardGoto(dispatcher: nkruntime.MatchDispatcher, fishing: FishingContext, state: WorldState, p: Player, body: unknown, now: number): void {
  const refuse = (reason: string) => {
    const msg: TeleportMsg = { x: p.move.x, y: p.move.y, reason };
    send(dispatcher, OpCode.TELEPORT, msg, [p.presence]);
  };
  const owner = typeof body === 'object' && body !== null ? (body as { userId?: unknown }).userId : undefined;
  if (typeof owner !== 'string') return;
  if (p.lastTeleportAt !== undefined && now - p.lastTeleportAt < FRIENDS.teleportCooldownMs) return refuse('RATE_LIMITED');
  p.lastTeleportAt = now;
  const stall = state.market.stalls[owner];
  if (!stall || !state.market.ads[owner]) return refuse('NOT_HERE');
  const spot = spotNear(state.map, stall.doc.x, stall.doc.y, FRIENDS.landRadius, FRIENDS.landMinDistance);
  if (!spot) return refuse('NO_SPOT');
  cancelFishing(fishing, p);
  p.move = newMoveState(spot.x, spot.y, now, moveCfg);
  p.moving = false;
  p.dirty = true;
  const msg: TeleportMsg = { x: spot.x, y: spot.y };
  send(dispatcher, OpCode.TELEPORT, msg, [p.presence]);
}

/** GOTO_SPAWN ("Başlangıca dön"): a random walkable tile in the square around the map spawn; the server picks it. */
function handleGotoSpawn(dispatcher: nkruntime.MatchDispatcher, fishing: FishingContext, state: WorldState, p: Player, now: number): void {
  const refuse = (reason: string) => {
    const msg: TeleportMsg = { x: p.move.x, y: p.move.y, reason };
    send(dispatcher, OpCode.TELEPORT, msg, [p.presence]);
  };
  if (p.tradeId) return refuse('BUSY');
  if (p.lastTeleportAt !== undefined && now - p.lastTeleportAt < FRIENDS.teleportCooldownMs) return refuse('RATE_LIMITED');
  if (p.lastSpawnTeleportAt !== undefined && now - p.lastSpawnTeleportAt < SPAWN_TELEPORT.cooldownMs) return refuse('RATE_LIMITED');
  const spot = randomSpotInArea(state.map, state.map.spawn.x, state.map.spawn.y, SPAWN_TELEPORT.areaTiles, Math.random);
  if (!spot) return refuse('NO_SPOT');
  p.lastTeleportAt = now;
  p.lastSpawnTeleportAt = now;
  cancelFishing(fishing, p);
  p.move = newMoveState(spot.x, spot.y, now, moveCfg);
  p.moving = false;
  p.dirty = true;
  const msg: TeleportMsg = { x: spot.x, y: spot.y };
  send(dispatcher, OpCode.TELEPORT, msg, [p.presence]);
}

function handleEmote(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, state: WorldState, p: Player, body: unknown, now: number): void {
  const emote = parseEmote(body, EMOTES);
  if (emote === null || !canEmote(p.lastEmoteAt, now, EMOTES)) return;
  if (emote === 'show_fish' && !p.lastCatch) return;
  p.lastEmoteAt = now;
  const msg: EmoteShowMsg = { id: p.presence.userId, emote };
  if (emote === 'show_fish') msg.defId = p.lastCatch;
  const to = [p.presence];
  for (const id in state.players) if (state.players[id].visible[p.presence.userId]) to.push(state.players[id].presence);
  send(dispatcher, OpCode.EMOTE_SHOW, msg, to);
  trackQuest(nk, logger, dispatcher, p, { event: 'emote' });
}

/** EMOTE_STATUS: wear or remove the persistent emote above the head. */
function handleEmoteStatus(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  state: WorldState,
  p: Player,
  body: unknown,
  now: number,
): void {
  const req = parseStatus(body, EMOTES);
  if (!req) return;
  const refuse = (reason: string) => {
    const msg: EmoteStatusShowMsg = { id: p.presence.userId, emote: p.status === undefined ? null : p.status, reason };
    send(dispatcher, OpCode.EMOTE_STATUS_SHOW, msg, [p.presence]);
  };
  if (p.lastStatusAt !== undefined && now - p.lastStatusAt < EMOTES.statusCooldownMs) return refuse('RATE_LIMITED');
  if (req.emote !== null && !canWear(req.emote, p.emotesOwned, EMOTES)) return refuse('NOT_OWNED');
  p.lastStatusAt = now;
  p.status = req.emote === null ? undefined : req.emote;
  try {
    nk.storageWrite([statusEmoteWrite(p.presence.userId, req.emote)]);
  } catch (e) {
    logger.error('Saving status emote failed: %s', String(e));
  }
  const msg: EmoteStatusShowMsg = { id: p.presence.userId, emote: req.emote };
  const to = [p.presence];
  for (const id in state.players) if (state.players[id].visible[p.presence.userId]) to.push(state.players[id].presence);
  send(dispatcher, OpCode.EMOTE_STATUS_SHOW, msg, to);
}

function tradeEnv(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, state: WorldState): TradeEnv {
  return { nk, logger, dispatcher, fishing: fishingContext(nk, logger, dispatcher, state), serverId: state.serverId, players: state.players, trades: state.trades };
}

function marketEnv(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, state: WorldState): MarketEnv {
  return { nk, logger, dispatcher, serverId: state.serverId, market: state.market, players: state.players };
}

const STALL_OPS: { [op: number]: true } = {
  [OpCode.STALL_OPEN]: true,
  [OpCode.STALL_RECALL]: true,
  [OpCode.STALL_VIEW]: true,
  [OpCode.STALL_BUY]: true,
  [OpCode.BOARD_AD]: true,
};

const TRADE_OPS: { [op: number]: true } = {
  [OpCode.TRADE_OFFER]: true,
  [OpCode.TRADE_REPLY]: true,
  [OpCode.TRADE_SET]: true,
  [OpCode.TRADE_LOCK]: true,
  [OpCode.TRADE_CONFIRM]: true,
};

function buildGrid(state: WorldState): SpatialGrid {
  const points = Object.keys(state.players).map((id) => ({ id, x: state.players[id].move.x, y: state.players[id].move.y }));
  return new SpatialGrid(WORLD.viewLeaveRadius, points);
}

export function worldLoop(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: WorldState,
  messages: nkruntime.MatchMessage[],
): { state: WorldState } | null {
  // Items, recipes and pages the admin panel publishes reach the match within seconds.
  getContent(nk, logger);
  const now = tick * tickMs;
  const moves: { [userId: string]: number } = {};
  const storageActions: { [userId: string]: true } = {};
  const says: { p: Player; body: unknown }[] = [];
  const fishing = fishingContext(nk, logger, dispatcher, state);
  const trade = tradeEnv(nk, logger, dispatcher, state);
  const market = marketEnv(nk, logger, dispatcher, state);

  for (const m of messages) {
    const p = state.players[m.sender.userId];
    if (!p || p.presence.sessionId !== m.sender.sessionId) continue;
    let body: unknown;
    try {
      body = JSON.parse(nk.binaryToString(m.data));
    } catch (_e) {
      continue;
    }
    if (m.opCode === OpCode.MOVE && p.tradeId) {
      // The trade window holds the player still.
      continue;
    } else if (m.opCode === OpCode.CAST && p.tradeId) {
      continue;
    } else if (m.opCode === OpCode.MOVE) {
      moves[m.sender.userId] = (moves[m.sender.userId] || 0) + 1;
      if (moves[m.sender.userId] <= WORLD.maxMovesPerTick && handleMove(dispatcher, state.map, p, body, now)) {
        cancelFishing(fishing, p);
      }
    } else if (m.opCode === OpCode.SAY) {
      says.push({ p, body });
    } else if (m.opCode === OpCode.CAST) {
      handleCast(fishing, p, body, now);
    } else if (m.opCode === OpCode.HOOK) {
      handleHook(fishing, p, now);
    } else if (m.opCode === OpCode.REEL_DONE) {
      handleReelDone(fishing, p, body, now);
    } else if (m.opCode === OpCode.CANCEL) {
      cancelFishing(fishing, p);
    } else if (m.opCode === OpCode.BOOK_PLACE && !storageActions[m.sender.userId]) {
      // One book action per player per tick; each one touches storage.
      storageActions[m.sender.userId] = true;
      handleBookPlace(nk, logger, dispatcher, p, body);
    } else if ((m.opCode === OpCode.SELL || m.opCode === OpCode.SALVAGE) && !storageActions[m.sender.userId]) {
      // Shares the one-storage-action-per-tick limit with the book.
      storageActions[m.sender.userId] = true;
      handleEconomy(nk, logger, dispatcher, p, m.opCode === OpCode.SELL ? 'sell' : 'salvage', body);
    } else if ((m.opCode === OpCode.MERGE || m.opCode === OpCode.CRAFT) && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleCraft(nk, logger, dispatcher, p, m.opCode === OpCode.MERGE ? 'merge' : 'craft', body);
    } else if ((m.opCode === OpCode.REPAIR_ROD || m.opCode === OpCode.BUY_BAIT) && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleShop(nk, logger, dispatcher, p, m.opCode === OpCode.REPAIR_ROD ? 'repair' : 'buy_bait', body);
    } else if (STASH_OPS[m.opCode] && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleStash(nk, logger, dispatcher, p, STASH_OPS[m.opCode], body);
    } else if (m.opCode === OpCode.GOTO_FRIEND) {
      handleGotoFriend(nk, dispatcher, fishing, state, p, body, now);
    } else if (m.opCode === OpCode.BOARD_GOTO) {
      handleBoardGoto(dispatcher, fishing, state, p, body, now);
    } else if (m.opCode === OpCode.GOTO_SPAWN) {
      handleGotoSpawn(dispatcher, fishing, state, p, now);
    } else if (m.opCode === OpCode.EMOTE) {
      handleEmote(nk, logger, dispatcher, state, p, body, now);
    } else if (m.opCode === OpCode.ITEM_DISCARD && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleItemDiscard(nk, logger, dispatcher, p, !!p.tradeId, body);
    } else if (m.opCode === OpCode.ITEM_LOCK && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleItemLock(nk, logger, dispatcher, p, body);
    } else if (TRADE_OPS[m.opCode] && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleTradeOp(trade, p, m.opCode, body, now);
    } else if (m.opCode === OpCode.QUEST_CLAIM && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleQuestClaim(nk, logger, dispatcher, p);
    } else if (STALL_OPS[m.opCode] && !storageActions[m.sender.userId]) {
      storageActions[m.sender.userId] = true;
      handleStallOp(market, p, m.opCode, body);
    } else if (m.opCode === OpCode.TRADE_CANCEL) {
      handleTradeOp(trade, p, m.opCode, body, now);
    } else if (m.opCode === OpCode.EMOTE_STATUS) {
      handleEmoteStatus(nk, logger, dispatcher, state, p, body, now);
    }
  }
  tickTrades(trade, now);
  tickMarket(market);
  if (state.serverId === SERVERS[0].id && Date.now() - state.sweptAt >= ACCOUNT_DELETE.sweepEveryMs) {
    state.sweptAt = Date.now();
    try {
      sweepDeletions(nk, logger, Date.now());
    } catch (e) {
      logger.error('Account deletion sweep failed: %s', String(e));
    }
  }
  for (const id in state.players) tickFishing(fishing, state.players[id], now);
  const wall = Date.now();
  if (wall - state.energySavedAt >= ENERGY.saveEveryMs) {
    state.energySavedAt = wall;
    flushEnergy(nk, logger, Object.keys(state.players).map((id) => state.players[id]));
  }
  for (const id in state.players) rollQuestDay(nk, logger, dispatcher, state.players[id], wall);

  // Positions are final for this tick; chat and visibility use them.
  const grid = buildGrid(state);
  for (const s of says) handleSay(nk, dispatcher, state, grid, s.p, s.body, now);

  for (const id in state.players) {
    const p = state.players[id];
    const change = updateVisibility({ id, x: p.move.x, y: p.move.y }, p.visible, grid, WORLD.viewRadius, WORLD.viewLeaveRadius);
    p.visible = change.visible;
    for (const otherId of change.entered) {
      const o = state.players[otherId];
      const enter: PlayerEnterMsg = { ...view(otherId, o), name: o.name, characterId: o.characterId };
      if (o.fish) enter.bobber = { x: o.fish.x, y: o.fish.y, band: o.fish.band };
      if (o.status) enter.status = o.status;
      send(dispatcher, OpCode.PLAYER_ENTER, enter, [p.presence]);
    }
    for (const otherId of change.left) {
      const leave: PlayerLeaveMsg = { id: otherId };
      send(dispatcher, OpCode.PLAYER_LEAVE, leave, [p.presence]);
    }
    const isNew: { [id: string]: true } = {};
    for (const otherId of change.entered) isNew[otherId] = true;
    const changed: PlayerView[] = [];
    for (const otherId in p.visible) {
      if (!isNew[otherId] && state.players[otherId].dirty) changed.push(view(otherId, state.players[otherId]));
    }
    if (changed.length > 0) {
      const snap: SnapshotMsg = { t: Math.round(now), players: changed };
      send(dispatcher, OpCode.SNAPSHOT, snap, [p.presence]);
    }
  }
  for (const id in state.players) state.players[id].dirty = false;
  const due: Player[] = [];
  for (const id in state.players) if (now - state.players[id].watchSavedAt >= WATCH.flushMs) due.push(state.players[id]);
  saveWatch(nk, logger, due, now);
  return { state };
}

export function worldTerminate(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: WorldState,
  _graceSeconds: number,
): { state: WorldState } | null {
  const market = marketEnv(nk, logger, dispatcher, state);
  for (const id in state.players) ownerLeft(market, state.players[id], true);
  savePositions(nk, logger, Object.keys(state.players).map((id) => state.players[id]));
  for (const id in state.players) saveEnergy(nk, logger, id, state.players[id].energy, false);
  saveWatch(nk, logger, Object.keys(state.players).map((id) => state.players[id]), tick * tickMs);
  return { state };
}

export function worldSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: WorldState,
  data: string,
): { state: WorldState; data?: string } | null {
  // "where": positions of the asked players who are in this server (friends list).
  let req: { type?: unknown; userIds?: unknown };
  try {
    req = JSON.parse(data);
  } catch (_e) {
    return { state };
  }
  // The admin panel published new content (admin/rpc.ts): read it on the next tick.
  if (req.type === 'content_reload') {
    invalidateContent();
    getContent(nk, logger);
    return { state, data: JSON.stringify({ ok: true }) };
  }
  // dev_* signals come only from the developer dashboard's RPCs (debug/).
  const dev = devSignal(ctx, logger, nk, dispatcher, tick, state, req as { [k: string]: unknown });
  if (dev !== null) return { state, data: dev };
  if (req.type !== 'where' || !Array.isArray(req.userIds)) return { state };
  const found: { [userId: string]: { x: number; y: number } } = {};
  for (const id of req.userIds) {
    const p = typeof id === 'string' ? state.players[id] : undefined;
    if (p) found[id as string] = { x: p.move.x, y: p.move.y };
  }
  return { state, data: JSON.stringify({ serverName: state.serverName, players: found }) };
}
