// Collection Book pages for Faz 3 (docs/tasarim/06-defter.md 8.2). Placeholder
// until the real item data exists; only Tier items (with Float) are records.
// Junk and materials are not in the book (Öneri, docs/acik-sorular.md).
import { BookPage } from '../rules/book';

export const BOOK_PAGES: BookPage[] = [
  { id: 'lake_fish', items: ['lake.fish.carp', 'lake.fish.perch', 'lake.fish.roach', 'lake.fish.pike', 'lake.fish.catfish'] },
  { id: 'deep_water', items: ['lake.fish.golden_carp', 'lake.item.blue_crystal'] },
  { id: 'treasures', items: ['lake.item.glasses', 'lake.item.old_coin'] },
];
