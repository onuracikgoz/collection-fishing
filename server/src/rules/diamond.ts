// Diamonds from fishing (docs/tasarim/11-monetization.md, Elmas). Pure functions.

export interface DiamondConfig {
  /** Diamonds a player gets on average per day of normal play. */
  perDay: number;
  /** Energy catches a day of normal play has (energy cap times how often the reel game is won). */
  catchesPerDay: number;
  /** Diamonds per drop. */
  amount: number;
}

/** Chance of a drop on one catch made with energy, so that a normal day gives `perDay` on average. */
export function dropChance(cfg: DiamondConfig): number {
  return Math.min(1, cfg.perDay / (cfg.catchesPerDay * cfg.amount));
}

/** Rolls the drop for one catch: how many diamonds (0 when none). Casts without energy never drop. */
export function rollDiamond(cfg: DiamondConfig, hasEnergy: boolean, random: () => number): number {
  if (!hasEnergy) return 0;
  return random() < dropChance(cfg) ? cfg.amount : 0;
}
