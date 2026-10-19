// Coin and dust: selling to the NPC and salvaging into dust.
// Rules: docs/tasarim/07-kopya-envanter.md 9, 16-ekonomi-tablosu.md 3. Pure functions, no Nakama dependency.
import { Category, Condition, FloatBand, Tier } from './catch';

export interface EconomyConfig {
  /** NPC price by category, before the Float multiplier. */
  sellPrice: { [c in Category]: number };
  /** NPC price multiplier by condition. Dust ignores Float. */
  conditionMultiplier: { [c in Condition]: number };
  /** Dust by category; null means it cannot be salvaged. */
  dust: { [c in Category]: number | null };
  /** Most entries (items plus stack lines) in one request. */
  maxEntries: number;
}

export type EconomyAction = 'sell' | 'salvage';

/** A bag item instance as the rules need it. */
export interface OwnedItem {
  instanceId: string;
  tier: Tier;
  float: number;
}

export interface EconomyRequest {
  items: string[];
  stacks: { defId: string; count: number }[];
}

export type EconomyReason = 'BAD_REQUEST' | 'TOO_MANY' | 'NOT_OWNED' | 'NOT_ENOUGH' | 'CANNOT_SALVAGE';

export type EconomyPlan =
  | {
      ok: true;
      /** Coin for sell, dust for salvage. */
      gained: number;
      removeItems: string[];
      /** Stack counts after the action, only the changed ones; 0 means the stack is gone. */
      stacksAfter: { [defId: string]: number };
      removedStacks: { defId: string; count: number }[];
    }
  | { ok: false; reason: EconomyReason };

const ID_MAX = 64;

/** Validates the wire body. Returns null if it is malformed. */
export function parseEconomyRequest(body: unknown): EconomyRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { items?: unknown; stacks?: unknown };
  const items: string[] = [];
  const stacks: { defId: string; count: number }[] = [];
  if (b.items !== undefined) {
    if (!Array.isArray(b.items)) return null;
    for (const id of b.items) {
      if (typeof id !== 'string' || id.length === 0 || id.length > ID_MAX) return null;
      items.push(id);
    }
  }
  if (b.stacks !== undefined) {
    if (!Array.isArray(b.stacks)) return null;
    for (const s of b.stacks) {
      if (typeof s !== 'object' || s === null) return null;
      const { defId, count } = s as { defId?: unknown; count?: unknown };
      if (typeof defId !== 'string' || defId.length === 0 || defId.length > ID_MAX) return null;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return null;
      stacks.push({ defId, count });
    }
  }
  return { items, stacks };
}

export function conditionOf(float: number, bands: FloatBand[]): Condition {
  for (const b of bands) if (float >= b.min && float < b.max) return b.condition;
  return bands[bands.length - 1].condition;
}

/** NPC price of one Float item: base by Tier times the condition multiplier, at least 1. */
export function itemPrice(item: OwnedItem, bands: FloatBand[], cfg: EconomyConfig): number {
  const base = cfg.sellPrice[item.tier];
  return Math.max(1, Math.round(base * cfg.conditionMultiplier[conditionOf(item.float, bands)]));
}

/**
 * Checks a sell or salvage request against what the player owns and returns
 * what to remove and what they get. Does not change its inputs.
 * `items` are bag items (book slot items are not in it), `stacks` the bag stacks,
 * `categoryOf` the category of a stackable definition (null if unknown).
 */
export function planEconomy(
  action: EconomyAction,
  req: EconomyRequest,
  items: { [instanceId: string]: OwnedItem },
  stacks: { [defId: string]: number },
  categoryOf: (defId: string) => Category | null,
  bands: FloatBand[],
  cfg: EconomyConfig,
): EconomyPlan {
  if (req.items.length + req.stacks.length === 0) return { ok: false, reason: 'BAD_REQUEST' };
  if (req.items.length + req.stacks.length > cfg.maxEntries) return { ok: false, reason: 'TOO_MANY' };

  let gained = 0;
  const seen: { [id: string]: true } = {};
  for (const id of req.items) {
    if (seen[id]) return { ok: false, reason: 'BAD_REQUEST' };
    seen[id] = true;
    const item = items[id];
    if (!item) return { ok: false, reason: 'NOT_OWNED' };
    if (action === 'sell') gained += itemPrice(item, bands, cfg);
    else {
      const d = cfg.dust[item.tier];
      if (d === null) return { ok: false, reason: 'CANNOT_SALVAGE' };
      gained += d;
    }
  }

  const want: { [defId: string]: number } = {};
  for (const s of req.stacks) want[s.defId] = (want[s.defId] || 0) + s.count;
  const stacksAfter: { [defId: string]: number } = {};
  const removedStacks: { defId: string; count: number }[] = [];
  for (const defId in want) {
    const have = stacks[defId] || 0;
    if (have === 0) return { ok: false, reason: 'NOT_OWNED' };
    if (want[defId] > have) return { ok: false, reason: 'NOT_ENOUGH' };
    const category = categoryOf(defId);
    if (!category) return { ok: false, reason: 'NOT_OWNED' };
    const each = action === 'sell' ? cfg.sellPrice[category] : cfg.dust[category];
    if (each === null) return { ok: false, reason: 'CANNOT_SALVAGE' };
    gained += each * want[defId];
    stacksAfter[defId] = have - want[defId];
    removedStacks.push({ defId, count: want[defId] });
  }

  return { ok: true, gained, removeItems: req.items.slice(), stacksAfter, removedStacks };
}
