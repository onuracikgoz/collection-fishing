// The stash (depo): moving things between bag and stash, its tiers, and the bank spot.
// Rules: docs/tasarim/07-kopya-envanter.md 9.3, prices 16-ekonomi-tablosu.md 4.5. Pure functions, no Nakama dependency.
import { BagConfig, BagSummary, slotsUsed } from './bag';
import { EconomyRequest } from './economy';

export interface StashConfig {
  /** Slots before any expansion. */
  baseSlots: number;
  stackSize: number;
  /** Expansions in order: tier 1 is tiers[0]. */
  tiers: { slots: number; price: number }[];
  /** The stash only opens this close to the bank (tiles). */
  bank: { x: number; y: number };
  range: number;
  /** Most entries (items plus stack lines) in one move. */
  maxEntries: number;
}

export function stashSlots(level: number, cfg: StashConfig): number {
  if (level <= 0) return cfg.baseSlots;
  return cfg.tiers[Math.min(level, cfg.tiers.length) - 1].slots;
}

export function stashBagConfig(level: number, cfg: StashConfig): BagConfig {
  return { slots: stashSlots(level, cfg), stackSize: cfg.stackSize };
}

export function atBank(pos: { x: number; y: number }, cfg: StashConfig): boolean {
  return Math.hypot(pos.x - cfg.bank.x, pos.y - cfg.bank.y) <= cfg.range;
}

export type ExpandPlan = { ok: true; level: number; price: number } | { ok: false; reason: 'MAX_LEVEL' | 'NOT_ENOUGH_COIN' };

export function planExpand(level: number, coin: number, cfg: StashConfig): ExpandPlan {
  if (level >= cfg.tiers.length) return { ok: false, reason: 'MAX_LEVEL' };
  const price = cfg.tiers[level].price;
  if (coin < price) return { ok: false, reason: 'NOT_ENOUGH_COIN' };
  return { ok: true, level: level + 1, price };
}

export type MoveReason = 'BAD_REQUEST' | 'TOO_MANY' | 'NOT_OWNED' | 'NOT_ENOUGH' | 'FULL';

export type MovePlan =
  | {
      ok: true;
      /** Item instances that change sides. */
      items: string[];
      /** Stack lines moved. */
      stacks: { defId: string; count: number }[];
      /** Both containers after the move. */
      from: BagSummary;
      to: BagSummary;
    }
  | { ok: false; reason: MoveReason };

/**
 * Moves items and stacks from one container to another (bag to stash or back).
 * `fromItems` are the instance ids in the source. The target must have room
 * for everything after the move; nothing changes if any line fails.
 */
export function planMove(
  req: EconomyRequest,
  fromItems: { [instanceId: string]: true },
  from: BagSummary,
  to: BagSummary,
  toCfg: BagConfig,
  maxEntries: number,
): MovePlan {
  const lines = req.items.length + req.stacks.length;
  if (lines === 0) return { ok: false, reason: 'BAD_REQUEST' };
  if (lines > maxEntries) return { ok: false, reason: 'TOO_MANY' };
  const seen: { [id: string]: true } = {};
  for (const id of req.items) {
    if (seen[id]) return { ok: false, reason: 'BAD_REQUEST' };
    seen[id] = true;
    if (!fromItems[id]) return { ok: false, reason: 'NOT_OWNED' };
  }
  const want: { [defId: string]: number } = {};
  for (const s of req.stacks) want[s.defId] = (want[s.defId] || 0) + s.count;
  const fromStacks = { ...from.stacks };
  const toStacks = { ...to.stacks };
  const moved: { defId: string; count: number }[] = [];
  for (const defId in want) {
    const have = fromStacks[defId] || 0;
    if (have === 0) return { ok: false, reason: 'NOT_OWNED' };
    if (want[defId] > have) return { ok: false, reason: 'NOT_ENOUGH' };
    if (have === want[defId]) delete fromStacks[defId];
    else fromStacks[defId] = have - want[defId];
    toStacks[defId] = (toStacks[defId] || 0) + want[defId];
    moved.push({ defId, count: want[defId] });
  }
  const after: BagSummary = { items: to.items + req.items.length, stacks: toStacks };
  if (slotsUsed(after, toCfg) > toCfg.slots) return { ok: false, reason: 'FULL' };
  return {
    ok: true,
    items: req.items.slice(),
    stacks: moved,
    from: { items: Math.max(0, from.items - req.items.length), stacks: fromStacks },
    to: after,
  };
}
