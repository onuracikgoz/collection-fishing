// Special baits: buying and how they shift the catch table. Pure functions, no Nakama dependency.
// Rules: docs/tasarim/03-balik-tutma.md 5.0.0 and 5.0.0.1, prices 16-ekonomi-tablosu.md 4.1.
import { BagConfig, BagSummary, slotsUsed } from './bag';
import { CatchTable, Category, ItemFavour } from './catch';
import { Band } from './water';

export interface BaitDef {
  /** Coin per bait at the shop. */
  price: number;
  /** Bands where it works; elsewhere it is wasted. All bands if missing. */
  bands?: Band[];
  /** Category weight multipliers. Bait never adds items, it only shifts weights. */
  boost: { [c in Category]?: number };
}

export interface BaitConfig {
  baits: { [defId: string]: BaitDef };
  /** Most baits in one purchase. */
  maxBuy: number;
}

export function baitDef(defId: string, cfg: BaitConfig): BaitDef | null {
  return Object.prototype.hasOwnProperty.call(cfg.baits, defId) ? cfg.baits[defId] : null;
}

/** True if the bait does anything in this band. */
export function baitWorks(bait: BaitDef, band: Band): boolean {
  return !bait.bands || bait.bands.indexOf(band) >= 0;
}

/** The catch table with the bait applied. Unchanged where the bait does not work. */
export function applyBait(table: CatchTable, bait: BaitDef | null, band: Band): CatchTable {
  if (!bait || !baitWorks(bait, band)) return table;
  const out: CatchTable = {};
  for (const k in table) {
    const c = k as Category;
    const m = bait.boost[c];
    out[c] = m !== undefined ? Math.round((table[c] || 0) * m) : table[c];
  }
  return out;
}

/**
 * Which items this cast's bait favours (those listing it in `baits`), or null
 * when every item weighs the same. A bait wasted in the wrong band favours nothing.
 */
export function baitFavour(defId: string | null | undefined, band: Band, cfg: BaitConfig, factor: number): ItemFavour | null {
  const bait = defId ? baitDef(defId, cfg) : null;
  if (!bait || !baitWorks(bait, band)) return null;
  return { bait: defId!, factor };
}

/** BUY_BAIT body: `{ defId, count }`. */
export function parseBuyBait(body: unknown, cfg: BaitConfig): { defId: string; count: number } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { defId, count } = body as { defId?: unknown; count?: unknown };
  if (typeof defId !== 'string' || !baitDef(defId, cfg)) return null;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > cfg.maxBuy) return null;
  return { defId, count };
}

export type BuyPlan = { ok: true; cost: number; count: number } | { ok: false; reason: 'NOT_ENOUGH_COIN' | 'BAG_FULL' };

/** Checks a purchase. `count` is the new stack total. */
export function planBuyBait(defId: string, count: number, coin: number, bag: BagSummary, bagCfg: BagConfig, cfg: BaitConfig): BuyPlan {
  const bait = baitDef(defId, cfg)!;
  const cost = bait.price * count;
  if (coin < cost) return { ok: false, reason: 'NOT_ENOUGH_COIN' };
  const total = (bag.stacks[defId] || 0) + count;
  if (slotsUsed({ items: bag.items, stacks: { ...bag.stacks, [defId]: total } }, bagCfg) > bagCfg.slots) return { ok: false, reason: 'BAG_FULL' };
  return { ok: true, cost, count: total };
}
