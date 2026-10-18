// Energy (docs/tasarim/03-balik-tutma.md 5.0.0.3). Pure functions, no Nakama dependency.

export interface EnergyConfig {
  max: number;
  castCost: number;
  /** Time to go from 0 to max while offline. */
  offlineFullMs: number;
}

/** Energy after `elapsedMs` offline, never above max. */
export function regenOffline(value: number, elapsedMs: number, cfg: EnergyConfig): number {
  if (!(elapsedMs > 0)) return Math.min(cfg.max, value);
  const gained = (elapsedMs / cfg.offlineFullMs) * cfg.max;
  return Math.min(cfg.max, Math.floor((value + gained) * 100) / 100);
}

/** Energy after a cast. Casting with no energy is allowed and free (junk only). */
export function spendCast(value: number, cfg: EnergyConfig): { value: number; hasEnergy: boolean } {
  if (value < cfg.castCost) return { value, hasEnergy: false };
  return { value: value - cfg.castCost, hasEnergy: true };
}
