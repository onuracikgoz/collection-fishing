// What can come out of Büyük Göl. Placeholder ids until the first item set
// (content/sets/) is ready; the real pool will be loaded from server data.
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
  { id: 'lake.fish.pike', category: 'rare', bands: ['mid', 'deep'] },
  { id: 'lake.item.old_coin', category: 'rare' },
  { id: 'lake.fish.catfish', category: 'epic', bands: ['mid', 'deep'] },
  { id: 'lake.fish.golden_carp', category: 'legendary', bands: ['deep'] },
  { id: 'lake.item.blue_crystal', category: 'mythic', bands: ['deep'] },
];
