// Collection Book (docs/tasarim/06-defter.md). Pure functions, no Nakama dependency.
// A record is permanent once an item was ever owned; a slot holds one copy.
import { CatchTable, Category, Tier } from './catch';

export interface BookPage {
  id: string;
  /** Item definition ids on this page, in display order. */
  items: string[];
}

/** What sits in a slot. The full item lives in storage; this is enough for rules. */
export interface SlotRef {
  instanceId: string;
  tier: Tier;
  float: number;
}

export interface BookEntry {
  foundAt: number;
  slot?: SlotRef;
}

export type BookEntries = { [defId: string]: BookEntry };

export interface LuckConfig {
  /** Bonus for a page with at least half of its records found. */
  halfPage: number;
  /** Bonus for a page with every record found (replaces halfPage). */
  fullPage: number;
  /** Upper limit for the total. */
  cap: number;
  /** Catch categories whose weight luck multiplies. */
  boosts: Category[];
}

export interface ScoreConfig {
  tierPoints: { [t in Tier]: number };
  /** Extra points for a page whose every slot is filled. */
  pageFilled: number;
}

export type RecordState = 'unknown' | 'found' | 'filled';

export function pageOf(pages: BookPage[], defId: string): BookPage | null {
  for (const p of pages) if (p.items.indexOf(defId) >= 0) return p;
  return null;
}

export function stateOf(entries: BookEntries, defId: string): RecordState {
  const e = entries[defId];
  if (!e) return 'unknown';
  return e.slot ? 'filled' : 'found';
}

function countPage(entries: BookEntries, page: BookPage): { found: number; filled: number } {
  let found = 0;
  let filled = 0;
  for (const id of page.items) {
    const e = entries[id];
    if (e) found++;
    if (e && e.slot) filled++;
  }
  return { found, filled };
}

/** Luck from records (found or filled). Removing an item from its slot keeps it. */
export function luckOf(entries: BookEntries, pages: BookPage[], cfg: LuckConfig): number {
  let luck = 0;
  for (const p of pages) {
    if (p.items.length === 0) continue;
    const { found } = countPage(entries, p);
    if (found === p.items.length) luck += cfg.fullPage;
    else if (found * 2 >= p.items.length) luck += cfg.halfPage;
  }
  return Math.min(luck, cfg.cap);
}

/** Collection Score counts only items sitting in slots (Öneri formula). */
export function scoreOf(entries: BookEntries, pages: BookPage[], cfg: ScoreConfig): number {
  let score = 0;
  for (const p of pages) {
    let filled = 0;
    for (const id of p.items) {
      const slot = entries[id] && entries[id].slot;
      if (!slot) continue;
      filled++;
      score += cfg.tierPoints[slot.tier];
    }
    if (p.items.length > 0 && filled === p.items.length) score += cfg.pageFilled;
  }
  return score;
}

/** Scales the weights of boosted categories by (1 + luck), keeping integers. */
export function applyLuck(table: CatchTable, luck: number, cfg: LuckConfig): CatchTable {
  if (luck <= 0) return table;
  const out: CatchTable = {};
  for (const k in table) {
    const c = k as Category;
    const w = table[c] || 0;
    out[c] = cfg.boosts.indexOf(c) >= 0 ? Math.round(w * (1 + luck)) : w;
  }
  return out;
}

export type CatchBookResult =
  /** Not a book item (junk, material, not on any page): goes to the bag. */
  | { kind: 'none' }
  /** First copy ever: recorded and placed in the slot. */
  | { kind: 'discovered'; page: string; pageComplete: boolean }
  /** Already recorded: goes to the bag. `better` means it could replace the slot. */
  | { kind: 'copy'; page: string; better: boolean };

/** Decides where a new Tier item goes. Does not change `entries`. */
export function onCatch(entries: BookEntries, pages: BookPage[], defId: string, float: number): CatchBookResult {
  const page = pageOf(pages, defId);
  if (!page) return { kind: 'none' };
  const e = entries[defId];
  if (!e) {
    const { found } = countPage(entries, page);
    return { kind: 'discovered', page: page.id, pageComplete: found + 1 === page.items.length };
  }
  return { kind: 'copy', page: page.id, better: !e.slot || float < e.slot.float };
}

/** Records the item and puts it in the slot. Returns new entries. */
export function discover(entries: BookEntries, defId: string, slot: SlotRef, now: number): BookEntries {
  const out: BookEntries = { ...entries };
  out[defId] = { foundAt: now, slot };
  return out;
}

/**
 * Puts a bag item into its slot. Whatever was in the slot goes back to the bag
 * (returned as `previous`). Only items whose record exists can be placed.
 */
export function place(
  entries: BookEntries,
  pages: BookPage[],
  defId: string,
  slot: SlotRef,
): { ok: true; entries: BookEntries; previous: SlotRef | null } | { ok: false; reason: 'NOT_IN_BOOK' | 'NOT_FOUND' } {
  if (!pageOf(pages, defId)) return { ok: false, reason: 'NOT_IN_BOOK' };
  const e = entries[defId];
  if (!e) return { ok: false, reason: 'NOT_FOUND' };
  const out: BookEntries = { ...entries };
  out[defId] = { foundAt: e.foundAt, slot };
  return { ok: true, entries: out, previous: e.slot || null };
}
