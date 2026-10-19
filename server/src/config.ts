// Tunable numbers for the world (docs/protokol.md). Values marked (Öneri)
// are not final; change them here, not in rules or match code.
import type { Category } from './rules/catch';

export interface ServerDef {
  /** Stable id, used to find the match again after a restart. */
  id: string;
  name: string;
  /** ISO 639-1 code shown in the server list. */
  language: string;
}

export const SERVERS: ServerDef[] = [
  { id: 'mercan', name: 'Mercan', language: 'tr' },
  { id: 'liman', name: 'Liman', language: 'tr' },
];

export const WORLD = {
  tickRate: 10, // Hz (Öneri)
  capacity: 200, // players per server
  walkSpeed: 4, // tiles per second (Öneri)
  speedTolerance: 1.2, // accepted speed = walkSpeed × tolerance
  burstSeconds: 0.5, // most walking that can pile up between MOVEs (Öneri)
  maxMovesPerTick: 4, // extra MOVEs from one player in a tick are dropped
  viewRadius: 20, // tiles, PLAYER_ENTER inside this (Öneri)
  viewLeaveRadius: 22, // tiles, PLAYER_LEAVE outside this (Öneri)
  chatRadius: 12, // tiles, BUBBLE goes to players inside this (Öneri)
};

export const USERNAME = {
  minLength: 3, // (Öneri)
  maxLength: 16, // (Öneri)
};

// --- Faz 2: fishing (docs/protokol.md, Balık tutma; docs/tasarim/03-balik-tutma.md) ---

export const WATER = {
  shoreMax: 2, // water up to 2 tiles from land is shore (Öneri)
  midMax: 5, // then mid up to 5, deep beyond (Öneri)
};

export const FISHING = {
  nearWater: 1.5, // tiles (Öneri)
  maxCast: 8, // tiles; one rod for now (Öneri)
  waitMinMs: 5000,
  waitMaxMs: 20000,
  maxTwitches: 3, // (Öneri)
  hookWindowMs: { common: 600, rare: 525, epic: 450, legendary: 400, mythic: 350 },
  hookGraceMs: 300, // network delay allowance (Öneri)
  reelEarlyToleranceMs: 500,
  reelTimeoutGraceMs: 5000,
};

// Integer weights, 10000 = %100 (03-balik-tutma.md 5.0.1).
// Recipes come with craft in Faz 4, so their weight is 0 for now.
export const CATCH_TABLE = {
  junk: 2500,
  common: 5000,
  material: 1200,
  rare: 900,
  epic: 300,
  recipe: 0,
  legendary: 50,
  mythic: 5,
};

// 05-esya-float.md 7.2
export const FLOAT_TABLE = [
  { condition: 'pristine' as const, min: 0.0, max: 0.05, weight: 2 },
  { condition: 'excellent' as const, min: 0.05, max: 0.2, weight: 13 },
  { condition: 'normal' as const, min: 0.2, max: 0.5, weight: 45 },
  { condition: 'worn' as const, min: 0.5, max: 0.8, weight: 30 },
  { condition: 'damaged' as const, min: 0.8, max: 1.0, weight: 10 },
];

// Reel mini game per tier (Öneri, playtest will tune). Tested with a simulated
// player in test/reel.test.ts: a quick player catches every tier, Common takes
// ~2 s and Mythic ~8-10 s for them; a slower player starts missing at Epic.
const reel = (barSize: number, fishSpeed: number, retargetSteps: number, gain: number, loss: number) => ({
  barSize,
  lift: 3,
  gravity: 2,
  maxVel: 18,
  fishSpeed,
  retargetSteps,
  gain,
  loss,
  maxSteps: 1500, // 30 s
  maxMs: 30000,
});
export const REEL_PARAMS = {
  common: reel(300, 3, 60, 7, 3),
  rare: reel(270, 5, 45, 5, 3),
  epic: reel(240, 6, 35, 4, 3),
  legendary: reel(230, 6, 28, 3, 2),
  mythic: reel(230, 6, 22, 2, 1),
};

export const ENERGY = {
  max: 100,
  castCost: 1,
  offlineFullMs: 8 * 60 * 60 * 1000, // full in ~8 h offline (Öneri)
};

export const BAG = {
  slots: 40, // (Öneri)
  stackSize: 99,
};

// Collection Book luck (docs/tasarim/06-defter.md 8.3, Öneri): per page, not per item.
export const BOOK_LUCK = {
  halfPage: 0.02,
  fullPage: 0.05,
  cap: 0.25,
  boosts: ['rare', 'epic', 'legendary', 'mythic'] as Category[],
};

// Collection Score (06-defter.md 8.4, Öneri until playtest): only filled slots count.
export const SCORE = {
  tierPoints: { common: 1, rare: 3, epic: 10, legendary: 30, mythic: 100 },
  pageFilled: 20,
};

export const PROFILE = {
  showcaseMax: 3, // docs/tasarim/10-sosyal.md 13.3
};

// Emotes (docs/tasarim/10-sosyal.md 13.2.2). show_fish holds up the last catch.
export const EMOTES = {
  list: ['wave', 'clap', 'dance', 'sit', 'laugh', 'show_fish'],
  cooldownMs: 2000, // (Öneri)
};

// Friends: "Yanına git" (10-sosyal.md 13.2.1).
export const FRIENDS = {
  teleportCooldownMs: 3000, // (Öneri)
  landRadius: 4, // tiles searched around the friend for a free spot
  maxListed: 300,
};
