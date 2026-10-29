// Developer-only match signals (tools/dev-dashboard). Only the dev_* RPCs send
// these, and only when DEV_TOOLS=true; game clients cannot send match signals.
// They let the dashboard look at and poke a live world match.
import { FISHING, WORLD } from '../config';
import { LAKE_POOL } from '../data/lake-pool';
import { OpCode } from '../protocol';
import { CatchRoll, tierOf } from '../rules/catch';
import { isWalkable } from '../rules/map';
import { newMoveState } from '../rules/movement';
import { Fisher, FishingContext, cancelFishing } from '../match/fishing';
import { currentEnergy, energyWrite, loadBag, readBook } from '../match/playerData';
import type { WorldState } from '../match/world';
import { isDevEnabled } from './gate';

const tickMs = 1000 / WORLD.tickRate;

type Req = { [k: string]: unknown };

function send(dispatcher: nkruntime.MatchDispatcher, op: number, body: unknown, to: nkruntime.Presence[]): void {
  if (to.length > 0) dispatcher.broadcastMessage(op, JSON.stringify(body), to, null, true);
}

function audience(state: WorldState, f: Fisher): nkruntime.Presence[] {
  const out = [f.presence];
  for (const id in state.players) if (state.players[id].visible[f.presence.userId]) out.push(state.players[id].presence);
  return out;
}

function fishingCtx(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, state: WorldState): FishingContext {
  return { nk, logger, dispatcher, water: state.water, audience: (f) => audience(state, f), everyone: () => Object.keys(state.players).map((id) => state.players[id].presence) };
}

function summary(state: WorldState, now: number) {
  return Object.keys(state.players).map((id) => {
    const p = state.players[id];
    const fish = p.fish
      ? {
          phase: p.fish.phase,
          x: p.fish.x,
          y: p.fish.y,
          band: p.fish.band,
          hasEnergy: p.fish.hasEnergy,
          biteInMs: Math.round(p.fish.biteAt - now),
          twitchesLeft: p.fish.twitches.length,
          hookLeftMs: p.fish.phase === 'bite' ? Math.round(p.fish.hookDeadline - now) : undefined,
          roll: p.fish.roll ? { defId: p.fish.roll.def.id, tier: p.fish.roll.tier } : undefined,
        }
      : undefined;
    return {
      userId: id,
      name: p.name,
      characterId: p.characterId,
      sessionId: p.presence.sessionId,
      x: p.move.x,
      y: p.move.y,
      dir: p.dir,
      moving: p.moving,
      energy: p.energy,
      bag: p.bag,
      bookRecords: Object.keys(p.book).length,
      sees: Object.keys(p.visible),
      lastCatch: p.lastCatch,
      fish,
    };
  });
}

/**
 * Handles a dev_* signal. Returns the reply data, or null if the type is not a dev signal.
 * Every reply is `{ ok, ... }`; `found: false` means the player is not in this match.
 */
export function devSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: WorldState,
  req: Req,
): string | null {
  if (typeof req.type !== 'string' || req.type.indexOf('dev_') !== 0) return null;
  if (!isDevEnabled(ctx)) return JSON.stringify({ ok: false, error: 'DEV_TOOLS off' });
  const now = tick * tickMs;
  const reply = (v: object) => JSON.stringify({ ok: true, serverId: state.serverId, serverName: state.serverName, ...v });

  if (req.type === 'dev_state') {
    return reply({ tick, now, players: summary(state, now) });
  }

  const userId = typeof req.userId === 'string' ? req.userId : '';
  const p = state.players[userId];
  if (req.type === 'dev_push_all') {
    // Push any server message to everyone in this match.
    const to = Object.keys(state.players).map((id) => state.players[id].presence);
    send(dispatcher, Number(req.op), req.body, to);
    return reply({ sent: to.length });
  }
  if (!p) return reply({ found: false });

  switch (req.type) {
    case 'dev_reload': {
      // Storage was changed by a dev RPC: refresh the match's cached copies.
      p.bag = loadBag(nk, userId);
      p.book = readBook(nk, userId);
      p.energy = currentEnergy(nk, userId);
      return reply({ found: true, energy: p.energy, bag: p.bag });
    }
    case 'dev_energy': {
      const v = Number(req.value);
      if (!isFinite(v) || v < 0) return reply({ found: true, error: 'bad value' });
      p.energy = v;
      nk.storageWrite([energyWrite(userId, v, true)]);
      return reply({ found: true, energy: p.energy });
    }
    case 'dev_teleport': {
      const x = Number(req.x);
      const y = Number(req.y);
      if (!isFinite(x) || !isFinite(y)) return reply({ found: true, error: 'bad position' });
      if (!req.force && !isWalkable(state.map, x, y)) return reply({ found: true, error: 'not walkable' });
      cancelFishing(fishingCtx(nk, logger, dispatcher, state), p);
      p.move = newMoveState(x, y, now, WORLD);
      p.moving = false;
      p.dirty = true;
      send(dispatcher, OpCode.TELEPORT, { x, y }, [p.presence]);
      return reply({ found: true, x, y });
    }
    case 'dev_fish': {
      const fs = p.fish;
      const action = String(req.action || '');
      if (action === 'cancel') {
        cancelFishing(fishingCtx(nk, logger, dispatcher, state), p);
        return reply({ found: true });
      }
      if (!fs) return reply({ found: true, error: 'not fishing' });
      if (action === 'bite_now') {
        if (fs.phase !== 'waiting') return reply({ found: true, error: 'not waiting' });
        fs.biteAt = now;
        fs.twitches = [];
        return reply({ found: true });
      }
      if (action === 'twitch') {
        send(dispatcher, OpCode.BOBBER, { id: userId, x: fs.x, y: fs.y, band: fs.band, state: 'twitch' }, audience(state, p));
        return reply({ found: true });
      }
      if (action === 'force') {
        // Skip the wait and make the next bite this catch. The hook window is
        // stretched so a person clicking in the dashboard can make it.
        if (fs.phase === 'reeling') return reply({ found: true, error: 'already reeling' });
        const defId = String(req.defId || '');
        const def = LAKE_POOL.filter((d) => d.id === defId)[0];
        if (!def) return reply({ found: true, error: 'unknown defId (lake pool only)' });
        const roll: CatchRoll = { def, tier: tierOf(def.category) };
        const windowMs = typeof req.windowMs === 'number' && req.windowMs > 0 ? req.windowMs : 30000;
        fs.roll = roll;
        fs.phase = 'bite';
        fs.twitches = [];
        fs.hookDeadline = now + Math.min(windowMs, 120000);
        send(dispatcher, OpCode.BOBBER, { id: userId, x: fs.x, y: fs.y, band: fs.band, state: 'bite' }, audience(state, p));
        return reply({ found: true, hookWindowMs: fs.hookDeadline - now, normalWindowMs: FISHING.hookWindowMs[roll.tier || 'common'] });
      }
      return reply({ found: true, error: 'unknown action' });
    }
    case 'dev_push': {
      // Push any server message to this player only, e.g. a FISH_END with a page
      // completion, to test how the client shows it. Nothing in storage changes.
      send(dispatcher, Number(req.op), req.body, [p.presence]);
      return reply({ found: true });
    }
    case 'dev_kick': {
      dispatcher.matchKick([p.presence]);
      return reply({ found: true });
    }
  }
  return reply({ found: true, error: 'unknown dev signal' });
}
