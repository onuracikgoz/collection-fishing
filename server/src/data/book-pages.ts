// Seed only: a fresh server starts with this (seed-content.ts); after the first admin panel save
// the stored content wins (docs/tasarim/19-icerik-yonetimi.md). Tests still use these lists.
// Collection Book pages for Faz 3 (docs/tasarim/06-defter.md 8.2). Placeholder
// until the real item data exists; only Tier items (with Float) are records.
// Crafted items have their own page (8.2 "Zanaat"); recipes are not records (8.2).
// Junk and materials are not in the book (Öneri, docs/acik-sorular.md).
import { BookPage } from '../rules/book';

export const BOOK_PAGES: BookPage[] = [
  { id: 'lake_fish', items: ['lake.fish.carp', 'lake.fish.perch', 'lake.fish.roach', 'lake.fish.crayfish', 'lake.fish.pike', 'lake.fish.catfish', 'lake.fish.old_turtle'] },
  { id: 'deep_water', items: ['lake.fish.golden_carp', 'lake.item.blue_crystal'] },
  { id: 'treasures', items: ['lake.item.glasses', 'lake.item.old_coin', 'lake.item.message_bottle'] },
  { id: 'crafts', items: ['craft.scale_charm', 'craft.moss_wreath', 'craft.pike_trophy'] },
];
