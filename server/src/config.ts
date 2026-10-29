// Tunable numbers for the world (docs/protokol.md). Values marked (Öneri)
// are not final; change them here, not in rules or match code.
import type { Tier } from './protocol';
import type { Category } from './rules/catch';
import type { EconomyConfig } from './rules/economy';
import type { CraftConfig } from './rules/craft';
import type { RodConfig } from './rules/rod';
import type { BaitConfig } from './rules/bait';
import type { StashConfig } from './rules/stash';
import { BANK_POINT } from './data/lake-map';

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
  recipe: 40, // ~0.4% (16-ekonomi-tablosu.md V5)
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

// Emotes (docs/tasarim/10-sosyal.md 13.2.2). Gestures are short; show_fish holds up the last catch.
// Status emotes stay above the head until removed. Tier: free for all, supporter /
// diamond / book need ownership (granted by other systems, never by the client).
export const EMOTES = {
  list: ['wave', 'clap', 'dance', 'cheer', 'sit', 'laugh', 'show_fish'],
  cooldownMs: 2000, // (Öneri)
  statusCooldownMs: 1000, // (Öneri)
  status: {
    smile: { tier: 'free' },
    laugh: { tier: 'free' },
    zzz: { tier: 'free' },
    fish: { tier: 'free' },
    ask: { tier: 'free' },
    heart: { tier: 'free' },
    note: { tier: 'free' },
    coffee: { tier: 'free' },
    star: { tier: 'supporter' },
    cool: { tier: 'supporter' },
    crown: { tier: 'supporter' },
    sparkle: { tier: 'supporter' },
    fire: { tier: 'diamond', gems: 50 }, // (Öneri)
    rain: { tier: 'diamond', gems: 50 },
    comet: { tier: 'diamond', gems: 50 },
    goldfish: { tier: 'book' },
  } as { [id: string]: { tier: 'free' | 'supporter' | 'diamond' | 'book'; gems?: number } },
};

// Server-wide announcements (docs/protokol.md, Duyurular).
export const ANNOUNCE = {
  minTier: 'epic' as Tier, // (Öneri) Epic and above
};

// XP and level (docs/tasarim/04-xp-level.md). All Öneri. xpToNext(level) = base + perLevel * level.
export const XP = {
  maxLevel: 50,
  base: 250,
  perLevel: 250,
  /** XP per successful catch by category. A cast without energy gives none (only junk comes out, and it must not be farmable). */
  catchXp: { junk: 1, material: 3, common: 10, rare: 25, recipe: 40, epic: 60, legendary: 150, mythic: 400 } as { [c in Category]: number },
  /** What a level opens, by level (shown on the level-up banner). */
  unlocks: { 10: ['trade'] } as { [level: number]: string[] },
};

// Pet stalls in the market area (docs/tasarim/09-ekonomi-pazar.md 12.3). All Öneri.
export const MARKET = {
  minLevel: 10,
  maxEntries: 12,
  maxPrice: 1_000_000_000,
  /** Cut of every sale, taken from the seller. */
  feePct: 0.05,
  ttlMs: 24 * 60 * 60 * 1000,
  titleMax: 40,
  /** Spots are a grid centred on the map's `market` point: 8 x 5 = 40. */
  columns: 8,
  rows: 5,
  spacing: 2,
  /** The owner must stand this close to the market point to open a stall. */
  areaRadius: 14,
  /** Buyers and viewers must be this close to the pet. */
  interactRadius: 7,
  /** First entries shown beside the pet. */
  topCount: 4,
};

// Safe trade window (docs/tasarim/07-kopya-envanter.md 9.1, docs/protokol.md Takas). All Öneri.
export const TRADE = {
  /** Both players need this level (04-xp-level.md; also a bot guard). */
  minLevel: 10,
  maxSlots: 8,
  maxDistance: 5,
  inviteMs: 15000,
  countdownMs: 3000,
  openTimeoutMs: 300000,
  offerCooldownMs: 3000,
};

// Account transfer code (docs/protokol.md, Giriş). All Öneri.
export const TRANSFER = {
  codeLength: 8,
  ttlMs: 10 * 60 * 1000,
  createPerHour: 5,
  /** Wrong codes allowed per client address in the window. */
  maxFails: 10,
  failWindowMs: 10 * 60 * 1000,
  /** A newly linked Steam account cannot trade or sell on the market for this long. */
  steamTradeLockMs: 72 * 60 * 60 * 1000,
};

// Friends: "Yanına git" (10-sosyal.md 13.2.1).
export const FRIENDS = {
  teleportCooldownMs: 3000, // (Öneri)
  landRadius: 4, // tiles searched around the friend for a free spot
  landMinDistance: 1.25, // tiles; closer and the two sprites overlap
  maxListed: 300,
};

// Coin and dust (docs/tasarim/16-ekonomi-tablosu.md 3, all Öneri).
// Junk gives 1 dust whether caught with energy or not: the bag stacks junk
// without remembering how it was caught (acik-sorular.md 14).
export const ECONOMY: EconomyConfig = {
  sellPrice: { junk: 1, material: 3, common: 5, rare: 25, epic: 100, legendary: 500, mythic: 3000, recipe: 50 },
  conditionMultiplier: { pristine: 3, excellent: 1.5, normal: 1, worn: 0.7, damaged: 0.5 },
  dust: { junk: 1, material: 2, common: 5, rare: 25, epic: 100, legendary: 400, mythic: 2000, recipe: null },
  maxEntries: 40, // one request can empty a full bag
  // Recipes sell by grade, not by category (16-ekonomi-tablosu.md 3).
  recipePrice: { normal: 50, good: 250, master: 1000 },
};

// Merge and craft (07-kopya-envanter.md 9.4, 08-recipe-craft.md 10.4 and 11.2,
// 16-ekonomi-tablosu.md 4.3-4.4; all Öneri).
export const CRAFT: CraftConfig = {
  mergeCount: 3,
  mergeDust: { common: 10, rare: 50, epic: 200, legendary: 800, mythic: 4000 },
  craftDust: { common: 20, rare: 80, epic: 300, legendary: 1200, mythic: 5000 },
  // Pristine and Excellent chances (%) by the average Float of the inputs.
  quality: [
    { below: 0.05, pristine: 6, excellent: 25 },
    { below: 0.2, pristine: 4, excellent: 20 },
    { below: 0.5, pristine: 2, excellent: 13 },
    { below: 1.01, pristine: 1, excellent: 8 },
  ],
  qualityWithoutFloat: { below: 1.01, pristine: 2, excellent: 13 },
  gradeMaxFloat: { normal: 1, good: 0.5, master: 0.2 },
};

// Rod durability and repair (03-balik-tutma.md 5.0.0.2, 16-ekonomi-tablosu.md 4.2; all Öneri).
// Everyone has a level 1 rod until XP brings better ones.
export const ROD: RodConfig = {
  levels: {
    1: { max: 200, fullRepair: 100 },
    2: { max: 200, fullRepair: 150 },
    3: { max: 200, fullRepair: 250 },
  },
  wearPerCatch: 1, // only catches with energy wear the rod
};

// Special baits (03-balik-tutma.md 5.0.0.1, 16-ekonomi-tablosu.md 4.1; multipliers Öneri).
export const BAIT: BaitConfig = {
  baits: {
    // Parlak yem: Rare and up a little more often, anywhere.
    'bait.shiny': { price: 5, boost: { rare: 1.3, epic: 1.3, legendary: 1.2, mythic: 1.2 } },
    // Kristal yem: only in deep water; rarer things and crystals.
    'bait.crystal': { price: 20, bands: ['deep'], boost: { epic: 1.5, legendary: 1.5, mythic: 2 }, tagBoost: { crystal: 4 } },
  },
  maxBuy: 99,
};

// The stash (07-kopya-envanter.md 9.3, 16-ekonomi-tablosu.md 4.5; all Öneri).
export const STASH: StashConfig = {
  baseSlots: 100,
  stackSize: 99,
  tiers: [
    { slots: 120, price: 2000 },
    { slots: 140, price: 5000 },
    { slots: 160, price: 12000 },
    { slots: 180, price: 30000 },
    { slots: 200, price: 75000 },
  ],
  // Banka in the south-west village (16-ilk-harita.md 5), from the map file's `bank` point.
  bank: { x: BANK_POINT.x, y: BANK_POINT.y },
  range: 3,
  maxEntries: 40,
};
