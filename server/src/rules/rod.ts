// Rod durability and repair. Pure functions, no Nakama dependency.
// Rules: docs/tasarim/03-balik-tutma.md 5.0.0.2, prices 16-ekonomi-tablosu.md 4.2.
import { Band } from './water';

export interface RodLevel {
  /** Durability of a fully repaired rod. */
  max: number;
  /** Coin for a repair from 0 to max; partial repairs cost their share. */
  fullRepair: number;
}

export interface RodConfig {
  /** Indexed by rod level (1, 2, 3...). */
  levels: { [level: number]: RodLevel };
  /** Durability lost per catch with energy, by band (deep wears the rod faster). */
  wear: { [b in Band]: number };
}

export interface Rod {
  level: number;
  durability: number;
}

export interface RodView extends Rod {
  max: number;
}

function levelOf(rod: Rod, cfg: RodConfig): RodLevel {
  return cfg.levels[rod.level] || cfg.levels[1];
}

export function newRod(cfg: RodConfig): Rod {
  return { level: 1, durability: levelOf({ level: 1, durability: 0 }, cfg).max };
}

/** Cleans a stored rod; anything broken becomes a new level 1 rod. */
export function normalizeRod(v: unknown, cfg: RodConfig): Rod {
  if (typeof v !== 'object' || v === null) return newRod(cfg);
  const { level, durability } = v as { level?: unknown; durability?: unknown };
  if (typeof level !== 'number' || !cfg.levels[level] || typeof durability !== 'number' || !isFinite(durability)) return newRod(cfg);
  return { level, durability: Math.max(0, Math.min(cfg.levels[level].max, Math.floor(durability))) };
}

export function rodView(rod: Rod, cfg: RodConfig): RodView {
  return { level: rod.level, durability: rod.durability, max: levelOf(rod, cfg).max };
}

/** A broken rod still fishes, but like a cast without energy: junk only. */
export function isBroken(rod: Rod): boolean {
  return rod.durability <= 0;
}

/** The rod after one catch in `band`. */
export function wearRod(rod: Rod, band: Band, cfg: RodConfig): Rod {
  return { level: rod.level, durability: Math.max(0, rod.durability - cfg.wear[band]) };
}

/** Coin for restoring `points` of durability, rounded up. */
export function repairCost(rod: Rod, points: number, cfg: RodConfig): number {
  const lv = levelOf(rod, cfg);
  return Math.ceil((points * lv.fullRepair) / lv.max);
}

export type RepairPlan = { ok: true; points: number; cost: number; rod: Rod } | { ok: false; reason: 'NOT_NEEDED' | 'NOT_ENOUGH_COIN' };

/**
 * Repairs the missing durability, or as much of it as `coin` pays for.
 * A poor player can always fix a few points instead of being stuck.
 */
export function planRepair(rod: Rod, coin: number, cfg: RodConfig): RepairPlan {
  const lv = levelOf(rod, cfg);
  const missing = lv.max - rod.durability;
  if (missing <= 0) return { ok: false, reason: 'NOT_NEEDED' };
  let points = Math.min(missing, Math.floor((Math.max(0, coin) * lv.max) / lv.fullRepair));
  // Rounding up the cost can make the last point unaffordable.
  while (points > 0 && repairCost(rod, points, cfg) > coin) points--;
  if (points <= 0) return { ok: false, reason: 'NOT_ENOUGH_COIN' };
  return { ok: true, points, cost: repairCost(rod, points, cfg), rod: { level: rod.level, durability: rod.durability + points } };
}
