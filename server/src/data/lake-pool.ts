// Seed only: a fresh server starts with this (seed-content.ts); after the first admin panel save
// the stored content wins (docs/tasarim/19-icerik-yonetimi.md). Tests still use these lists.
// What can come out of Büyük Göl. Placeholder ids until the first item set
// (content/sets/) is ready; the real pool will be loaded from server data.
// Catch fields (waters, bands, baits, minLevel) follow 03-balik-tutma.md
// "Eşyanın çıkış alanları": a missing field means no limit. Every band has
// records of its own, so the book needs the shore as much as deep water.
import { ItemDef } from '../rules/catch';

export const LAKE_POOL: ItemDef[] = [
  { id: 'lake.junk.boot', category: 'junk' },
  { id: 'lake.junk.can', category: 'junk' },
  { id: 'lake.junk.shell', category: 'junk' },
  { id: 'lake.junk.stone', category: 'junk' },
  { id: 'lake.fish.carp', category: 'common' },
  { id: 'lake.fish.perch', category: 'common' },
  { id: 'lake.fish.roach', category: 'common' },
  { id: 'lake.item.glasses', category: 'common' },
  { id: 'lake.mat.scale', category: 'material' },
  { id: 'lake.mat.moss', category: 'material' },
  { id: 'lake.fish.crayfish', category: 'rare', bands: ['shore'] },
  { id: 'lake.fish.pike', category: 'rare', bands: ['mid', 'deep'] },
  { id: 'lake.item.old_coin', category: 'rare' },
  { id: 'lake.item.message_bottle', category: 'epic', bands: ['shore'], baits: ['bait.shiny'] },
  { id: 'lake.fish.catfish', category: 'epic', bands: ['mid', 'deep'] },
  { id: 'lake.fish.old_turtle', category: 'legendary', bands: ['shore'] },
  { id: 'lake.fish.golden_carp', category: 'legendary', bands: ['deep'] },
  { id: 'lake.item.blue_crystal', category: 'mythic', bands: ['deep'], baits: ['bait.crystal'] },
  // "Şişedeki recipe" (08-recipe-craft.md 10.3); stacks like materials.
  { id: 'recipe.scale_charm', category: 'recipe' },
  { id: 'recipe.moss_wreath', category: 'recipe' },
  { id: 'recipe.pike_trophy', category: 'recipe', bands: ['mid', 'deep'] },
  { id: 'recipe.shiny_bait', category: 'recipe' },
];
