// Fishing flow from cast to result (docs/protokol.md, Balık tutma).
// Pure functions over a small state object, driven by the match tick.
import { BagConfig, BagSummary, hasFreeSlot } from './bag';
import { CatchRoll, Tier } from './catch';
import { Random } from './rng';
import { ReelParams, ReelResult, STEP_MS } from './reel';
import { Band, WaterMap, bandAt, isNearWater } from './water';

export type RejectReason = 'BUSY' | 'NOT_NEAR_WATER' | 'NOT_WATER' | 'TOO_FAR' | 'BAG_FULL';

export interface FishingConfig {
  /** Player must be this close to water to cast (tiles). */
  nearWater: number;
  /** Farthest cast (tiles). */
  maxCast: number;
  waitMinMs: number;
  waitMaxMs: number;
  maxTwitches: number;
  /** Bite window per tier, ms; junk and materials use common. */
  hookWindowMs: { [t in Tier]: number };
  /** Extra time allowed for network delay on HOOK. */
  hookGraceMs: number;
  /** REEL_DONE may not arrive earlier than the game could have ended, minus this. */
  reelEarlyToleranceMs: number;
  /** Time after maxMs before an unfinished reel counts as escaped. */
  reelTimeoutGraceMs: number;
}

export type FishPhase = 'waiting' | 'bite' | 'reeling';

export interface FishState {
  phase: FishPhase;
  x: number;
  y: number;
  band: Band;
  /** Whether this cast spent energy (else junk only). */
  hasEnergy: boolean;
  biteAt: number;
  /** Twitch times not yet shown. */
  twitches: number[];
  hookDeadline: number;
  roll?: CatchRoll;
  seed?: number;
  params?: ReelParams;
  reelStartAt?: number;
}

export interface CastIntent {
  x: number;
  y: number;
}

export function parseCast(body: unknown): CastIntent | null {
  if (typeof body !== 'object' || body === null) return null;
  const { x, y } = body as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return null;
  return { x, y };
}

/** Checks a cast. Returns the band, or why it was refused. */
export function checkCast(
  water: WaterMap,
  player: { x: number; y: number },
  target: CastIntent,
  busy: boolean,
  bag: BagSummary,
  bagCfg: BagConfig,
  cfg: FishingConfig,
): { ok: true; band: Band } | { ok: false; reason: RejectReason } {
  if (busy) return { ok: false, reason: 'BUSY' };
  if (!isNearWater(water, player.x, player.y, cfg.nearWater)) return { ok: false, reason: 'NOT_NEAR_WATER' };
  const band = bandAt(water, target.x, target.y);
  if (band === null) return { ok: false, reason: 'NOT_WATER' };
  if (Math.hypot(target.x - player.x, target.y - player.y) > cfg.maxCast) return { ok: false, reason: 'TOO_FAR' };
  if (!hasFreeSlot(bag, bagCfg)) return { ok: false, reason: 'BAG_FULL' };
  return { ok: true, band };
}

/** Plans the wait: when the real bite comes and when fake twitches happen before it. */
export function planWait(now: number, cfg: FishingConfig, random: Random): { biteAt: number; twitches: number[] } {
  const wait = cfg.waitMinMs + Math.floor(random() * (cfg.waitMaxMs - cfg.waitMinMs + 1));
  const biteAt = now + wait;
  const count = Math.floor(random() * (cfg.maxTwitches + 1));
  const twitches: number[] = [];
  for (let i = 0; i < count; i++) {
    // Not in the first second (the bobber just landed) nor the last one before the bite.
    const lo = now + 1000;
    const hi = biteAt - 1000;
    if (hi > lo) twitches.push(lo + Math.floor(random() * (hi - lo)));
  }
  twitches.sort((a, b) => a - b);
  return { biteAt, twitches };
}

export function hookWindow(roll: CatchRoll, cfg: FishingConfig): number {
  return cfg.hookWindowMs[roll.tier || 'common'];
}

/** What a HOOK at `now` means. */
export function onHook(state: FishState, now: number): 'missed' | 'reel' | 'ignore' {
  if (state.phase === 'waiting') return 'missed';
  if (state.phase === 'bite') return now <= state.hookDeadline ? 'reel' : 'missed';
  return 'ignore';
}

/**
 * Judges REEL_DONE. `result` is the replayed game. A report that arrives
 * faster than the game could end is treated as escaped.
 */
export function judgeReel(state: FishState, result: ReelResult, now: number, cfg: FishingConfig): 'caught' | 'escaped' {
  const earliest = (state.reelStartAt || 0) + result.steps * STEP_MS - cfg.reelEarlyToleranceMs;
  if (now < earliest) return 'escaped';
  return result.caught ? 'caught' : 'escaped';
}

export function reelTimedOut(state: FishState, now: number, cfg: FishingConfig): boolean {
  return state.phase === 'reeling' && now > (state.reelStartAt || 0) + (state.params ? state.params.maxMs : 0) + cfg.reelTimeoutGraceMs;
}
