// One server = one authoritative match on the shared map (docs/mimari.md).
// Thin layer: every decision is made by the pure functions in rules/.
import { ENERGY, SERVERS, WATER, WORLD } from '../config';
import { LAKE_MAP } from '../data/lake-map';
import {
  BubbleMsg,
  CorrectionMsg,
  Dir,
  OpCode,
  PlayerEnterMsg,
  PlayerLeaveMsg,
  PlayerView,
  SnapshotMsg,
  WelcomeMsg,
} from '../protocol';
import { canSpeak, sanitizeChat } from '../rules/chat';
import { checkJoin } from '../rules/join';
import { buildCollisionMap, CollisionMap, isWalkable } from '../rules/map';
import { applyMove, MoveState, newMoveState, parseMove } from '../rules/movement';
import { SpatialGrid, updateVisibility } from '../rules/proximity';
import { buildWaterMap, WaterMap } from '../rules/water';
import { BagSummary } from '../rules/bag';
import { FishState } from '../rules/fishing';
import { Fisher, FishingContext, cancelFishing, handleCast, handleHook, handleReelDone, tickFishing } from './fishing';
import { currentEnergy, energyWrite, loadBag } from './playerData';
import { WorldLabel } from './servers';

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
  /** Ids this player currently sees. */
  visible: { [id: string]: true };
  /** Changed since the last SNAPSHOT. */
  dirty: boolean;
  energy: number;
  bag: BagSummary;
  fish?: FishState;
}

export interface WorldState {
  serverId: string;
  serverName: string;
  /** Kept in state, not a global: Nakama makes globals read-only. */
  map: CollisionMap;
  water: WaterMap;
  players: { [userId: string]: Player };
  /** Join metadata accepted in matchJoinAttempt, keyed by session. */
  pending: { [sessionId: string]: string };
}

const tickMs = 1000 / WORLD.tickRate;
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
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  params: { [key: string]: any },
): { state: WorldState; tickRate: number; label: string } {
  const serverId = String(params.serverId);
  const def = SERVERS.filter((s) => s.id === serverId)[0];
  const label: WorldLabel = { kind: 'world', serverId };
  return {
    state: { serverId, serverName: def ? def.name : serverId, map: buildCollisionMap(LAKE_MAP), water: buildWaterMap(LAKE_MAP, WATER), players: {}, pending: {} },
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
  state.pending[presence.sessionId] = check.characterId;
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
  const map = state.map;
  const now = tick * tickMs;
  const fresh = presences.filter((p) => !state.players[p.userId]).map((p) => p.userId);
  const saved = readPositions(nk, fresh);

  for (const presence of presences) {
    const characterId = state.pending[presence.sessionId] || 'default';
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

    // A reconnect keeps the live energy and bag; a fresh join loads them.
    const energy = old ? old.energy : currentEnergy(nk, presence.userId);
    const bag = old ? old.bag : loadBag(nk, presence.userId);
    if (!old) saveEnergy(nk, logger, presence.userId, energy, true);

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
      bag,
    };
    const welcome: WelcomeMsg = { you: { id: presence.userId, x, y }, serverName: state.serverName, energy, energyMax: ENERGY.max };
    send(dispatcher, OpCode.WELCOME, welcome, [presence]);
  }
  return { state };
}

export function worldLeave(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
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
  const to = grid.near(p.move.x, p.move.y, WORLD.chatRadius).map((q) => state.players[q.id].presence);
  const msg: BubbleMsg = { id: p.presence.userId, text };
  send(dispatcher, OpCode.BUBBLE, msg, to);
}

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
  const now = tick * tickMs;
  const moves: { [userId: string]: number } = {};
  const says: { p: Player; body: unknown }[] = [];
  const fishing = fishingContext(nk, logger, dispatcher, state);

  for (const m of messages) {
    const p = state.players[m.sender.userId];
    if (!p || p.presence.sessionId !== m.sender.sessionId) continue;
    let body: unknown;
    try {
      body = JSON.parse(nk.binaryToString(m.data));
    } catch (_e) {
      continue;
    }
    if (m.opCode === OpCode.MOVE) {
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
    }
  }
  for (const id in state.players) tickFishing(fishing, state.players[id], now);

  // Positions are final for this tick; chat and visibility use them.
  const grid = buildGrid(state);
  for (const s of says) handleSay(dispatcher, state, grid, s.p, s.body, now);

  for (const id in state.players) {
    const p = state.players[id];
    const change = updateVisibility({ id, x: p.move.x, y: p.move.y }, p.visible, grid, WORLD.viewRadius, WORLD.viewLeaveRadius);
    p.visible = change.visible;
    for (const otherId of change.entered) {
      const o = state.players[otherId];
      const enter: PlayerEnterMsg = { ...view(otherId, o), name: o.name, characterId: o.characterId };
      if (o.fish) enter.bobber = { x: o.fish.x, y: o.fish.y, band: o.fish.band };
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
  return { state };
}

export function worldTerminate(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: WorldState,
  _graceSeconds: number,
): { state: WorldState } | null {
  savePositions(nk, logger, Object.keys(state.players).map((id) => state.players[id]));
  for (const id in state.players) saveEnergy(nk, logger, id, state.players[id].energy, false);
  return { state };
}

export function worldSignal(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: WorldState,
  _data: string,
): { state: WorldState; data?: string } | null {
  return { state };
}
