// XP and level (docs/tasarim/04-xp-level.md). Pure functions. Total XP is what is stored; level comes from it.
import { Category } from './catch';

export interface XpConfig {
  maxLevel: number;
  base: number;
  perLevel: number;
  catchXp: { [c in Category]: number };
  unlocks: { [level: number]: string[] };
}

export interface LevelView {
  level: number;
  /** XP earned inside this level. */
  xp: number;
  /** XP this level needs, 0 at the top level. */
  xpNext: number;
}

/** XP needed to go from `level` to the next one. */
export function xpToNext(level: number, cfg: XpConfig): number {
  return cfg.base + cfg.perLevel * level;
}

export function levelOf(total: number, cfg: XpConfig): LevelView {
  let level = 1;
  let left = Math.max(0, Math.floor(total));
  while (level < cfg.maxLevel && left >= xpToNext(level, cfg)) {
    left -= xpToNext(level, cfg);
    level++;
  }
  if (level >= cfg.maxLevel) return { level, xp: left, xpNext: 0 };
  return { level, xp: left, xpNext: xpToNext(level, cfg) };
}

/** Total XP at which `level` starts. */
export function totalForLevel(level: number, cfg: XpConfig): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, cfg.maxLevel); l++) total += xpToNext(l, cfg);
  return total;
}

/** XP for one catch. Casts without energy give none. */
export function xpForCatch(category: Category, hasEnergy: boolean, cfg: XpConfig): number {
  return hasEnergy ? cfg.catchXp[category] : 0;
}

export interface XpGain extends LevelView {
  gained: number;
  /** Set when this catch crossed one or more levels. */
  levelUp?: { level: number; unlocks: string[] };
}

/** New total after a gain, and what to tell the player. */
export function addXp(total: number, gained: number, cfg: XpConfig): { total: number; gain: XpGain } {
  const before = levelOf(total, cfg);
  const next = total + gained;
  const after = levelOf(next, cfg);
  const gain: XpGain = { gained, ...after };
  if (after.level > before.level) {
    const unlocks: string[] = [];
    for (let l = before.level + 1; l <= after.level; l++) for (const u of cfg.unlocks[l] || []) unlocks.push(u);
    gain.levelUp = { level: after.level, unlocks };
  }
  return { total: next, gain };
}

/** Parses the stored XP document. */
export function normalizeXp(value: unknown): number {
  const v = typeof value === 'object' && value !== null ? (value as { total?: unknown }).total : 0;
  return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0;
}
