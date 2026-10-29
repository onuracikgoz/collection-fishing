// Fishing flow from cast to result (docs/protokol.md, Balık tutma).
// Pure functions over a small state object, driven by the match tick.
import { BagConfig, BagSummary, hasFreeSlot } from './bag';
import { CatchRoll, Tier } from './catch';
import { Random } from './rng';
import { ReelParams, ReelResult, STEP_MS } from './reel';
import { Band, WaterMap, bandAt, isNearWater, waterAt } from './water';

export type RejectReason = 'BUSY' | 'NOT_NEAR_WATER' | 'NOT_WATER' | 'TOO_FAR' | 'BAG_FULL' | 'NO_BAIT' | 'NO_ENERGY' | 'ROD_BROKEN';

export interface FishingConfig {
  /** Player must be this close to water to cast (tiles). */
  nearWater: number;
  /** Farthest cast (tiles). */
  maxCast: number;
  /** Wait before the bite per band: quick on the shore, long in deep water. */
  wait: { [b in Band]: { minMs: number; maxMs: number } };
  /** Reel mini game per band, applied on top of the Tier's params. */
  reel: { [b in Band]: ReelBandMod };
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

/** How a band changes the reel game: deep fish fight harder, shore fish less. */
export interface ReelBandMod {
  /** Bar size multiplier (bigger is easier). */
  barScale: number;
  /** Added to the fish's speed (faster is harder). */
  fishSpeedAdd: number;
}

export type FishPhase = 'waiting' | 'bite' | 'reeling';

export interface FishState {
  phase: FishPhase;
  x: number;
  y: number;
  band: Band;
  /** Named water under the bobber (map file `waters`), null if unnamed. */
  water?: string | null;
  /** Whether this cast spent energy (else junk only). */
  hasEnergy: boolean;
  /** Special bait spent on this cast. */
  bait?: string;
  biteAt: number;
  /** Twitch times not yet shown. */
  twitches: number[];
  hookDeadline: number;
  /** When the bite was shown (match time), for the hook reaction time. */
  bitAt?: number;
  roll?: CatchRoll;
  seed?: number;
  params?: ReelParams;
  reelStartAt?: number;
}

export interface CastIntent {
  x: number;
  y: number;
  /** Special bait id; basic bait if missing. */
  bait?: string;
}

export function parseCast(body: unknown): CastIntent | null {
  if (typeof body !== 'object' || body === null) return null;
  const { x, y, bait } = body as { x?: unknown; y?: unknown; bait?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return null;
  if (bait === undefined || bait === null) return { x, y };
  if (typeof bait !== 'string' || bait.length === 0 || bait.length > 64) return null;
  return { x, y, bait };
}

/**
 * Checks a cast's special bait after the cast itself was accepted. A bait that
 * could only be wasted (no energy, broken rod) refuses the cast instead.
 */
export function checkBait(
  bait: string,
  known: boolean,
  stacks: { [defId: string]: number },
  hasEnergy: boolean,
  rodBroken: boolean,
): { ok: true } | { ok: false; reason: RejectReason } {
  if (!known || (stacks[bait] || 0) < 1) return { ok: false, reason: 'NO_BAIT' };
  if (rodBroken) return { ok: false, reason: 'ROD_BROKEN' };
  if (!hasEnergy) return { ok: false, reason: 'NO_ENERGY' };
  return { ok: true };
}

/** Checks a cast. Returns the band and named water, or why it was refused. */
export function checkCast(
  water: WaterMap,
  player: { x: number; y: number },
  target: CastIntent,
  busy: boolean,
  bag: BagSummary,
  bagCfg: BagConfig,
  cfg: FishingConfig,
): { ok: true; band: Band; water: string | null } | { ok: false; reason: RejectReason } {
  if (busy) return { ok: false, reason: 'BUSY' };
  if (!isNearWater(water, player.x, player.y, cfg.nearWater)) return { ok: false, reason: 'NOT_NEAR_WATER' };
  const band = bandAt(water, target.x, target.y);
  if (band === null) return { ok: false, reason: 'NOT_WATER' };
  if (Math.hypot(target.x - player.x, target.y - player.y) > cfg.maxCast) return { ok: false, reason: 'TOO_FAR' };
  if (!hasFreeSlot(bag, bagCfg)) return { ok: false, reason: 'BAG_FULL' };
  return { ok: true, band, water: waterAt(water, target.x, target.y) };
}

/** Plans the wait: when the real bite comes and when fake twitches happen before it. */
export function planWait(now: number, band: Band, cfg: FishingConfig, random: Random): { biteAt: number; twitches: number[] } {
  const { minMs, maxMs } = cfg.wait[band];
  const wait = minMs + Math.floor(random() * (maxMs - minMs + 1));
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

/** The reel params for a catch: its Tier's game, made easier or harder by the band. Integers only. */
export function reelParamsFor(tierParams: ReelParams, band: Band, cfg: FishingConfig): ReelParams {
  const mod = cfg.reel[band];
  return {
    ...tierParams,
    barSize: Math.max(1, Math.round(tierParams.barSize * mod.barScale)),
    fishSpeed: Math.max(1, tierParams.fishSpeed + mod.fishSpeedAdd),
  };
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
