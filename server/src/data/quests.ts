// Seed only: a fresh server starts with this (seed-content.ts); after the first admin panel save
// the stored content wins (docs/tasarim/19-icerik-yonetimi.md). Tests still use these lists.
// Daily quest list and the chests (docs/protokol.md, Günlük görev; docs/tasarim/03-balik-tutma.md 5.2).
// Placeholder numbers (Öneri): the admin panel will own these later. The client shows a quest's text by its id.
import { ChestDef, QuestDef } from '../rules/quest';

export const QUESTS: QuestDef[] = [
  { id: 'catch_5', event: 'catch', target: 5 },
  { id: 'catch_10', event: 'catch', target: 10 },
  { id: 'catch_rare_1', event: 'catch_tier', target: 1, minTier: 'rare' },
  { id: 'catch_epic_1', event: 'catch_tier', target: 1, minTier: 'epic' },
  { id: 'sell_5', event: 'sell', target: 5 },
  { id: 'craft_1', event: 'craft', target: 1 },
  { id: 'merge_1', event: 'merge', target: 1 },
  { id: 'emote_3', event: 'emote', target: 3 },
  { id: 'trade_1', event: 'trade', target: 1, minLevel: 10 },
];

const POOL = [
  { weight: 5, defId: 'lake.mat.scale', count: 3 },
  { weight: 5, defId: 'lake.mat.moss', count: 3 },
  { weight: 3, defId: 'bait.shiny', count: 3 },
  { weight: 1, defId: 'bait.crystal', count: 1 },
];

/** Chest of streak day 1..10. Day 10 is the best and holds a guaranteed Good recipe (03-balik-tutma.md 5.2). */
export const CHESTS: ChestDef[] = [
  { coin: [40, 60], dust: [0, 0], rolls: 1, pool: POOL, guaranteed: [] },
  { coin: [50, 70], dust: [0, 0], rolls: 1, pool: POOL, guaranteed: [] },
  { coin: [60, 90], dust: [2, 5], rolls: 1, pool: POOL, guaranteed: [] },
  { coin: [70, 100], dust: [2, 5], rolls: 1, pool: POOL, guaranteed: [] },
  { coin: [90, 130], dust: [4, 8], rolls: 2, pool: POOL, guaranteed: [] },
  { coin: [100, 150], dust: [4, 8], rolls: 2, pool: POOL, guaranteed: [] },
  { coin: [120, 170], dust: [6, 12], rolls: 2, pool: POOL, guaranteed: [] },
  { coin: [140, 200], dust: [6, 12], rolls: 2, pool: POOL, guaranteed: [{ defId: 'recipe.scale_charm', count: 1 }] },
  { coin: [170, 240], dust: [10, 18], rolls: 3, pool: POOL, guaranteed: [] },
  { coin: [300, 450], dust: [20, 35], rolls: 3, pool: POOL, guaranteed: [{ defId: 'recipe.pike_trophy', count: 1 }] },
];
