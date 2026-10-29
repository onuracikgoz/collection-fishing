// Trade and stall sale records, kept for fraud complaints (docs/tasarim/07-kopya-envanter.md 9.1,
// docs/protokol.md Takas kayıtları). Pure functions, no Nakama dependency.
import type { ItemInstance, Tier } from '../protocol';

export type LogKind = 'trade' | 'stall_buy' | 'stall_sale';

/** What an item was when it changed hands; the item itself may later be sold or salvaged. */
export interface ItemSnap {
  instanceId: string;
  defId: string;
  tier: Tier;
  float: number;
}

export interface LogSide {
  items: ItemSnap[];
  stacks: { defId: string; count: number }[];
  coin: number;
}

export interface TradeLogEntry {
  kind: LogKind;
  /** The other player. */
  with: string;
  withName: string;
  at: number;
  serverId: string;
  gave: LogSide;
  got: LogSide;
  /** stall_sale: the market fee kept from the price. */
  fee?: number;
  /** trade: the trade id; stall_*: '' */
  ref: string;
}

export const snap = (i: ItemInstance): ItemSnap => ({ instanceId: i.instanceId, defId: i.defId, tier: i.tier, float: i.float });

export const emptySide = (): LogSide => ({ items: [], stacks: [], coin: 0 });

/** Storage key: sorts by time, unique per entry. */
export const logKey = (at: number, kind: LogKind, ref: string): string => `${String(at).padStart(15, '0')}_${kind}_${ref}`;

/** Both sides of one stall purchase: the buyer paid `total`, the seller got `total - fee`. */
export function stallEntries(
  a: { buyer: string; buyerName: string; seller: string; sellerName: string; at: number; serverId: string; key: string },
  what: { item?: ItemSnap; stack?: { defId: string; count: number } },
  total: number,
  fee: number,
): { buyer: TradeLogEntry; seller: TradeLogEntry } {
  const goods: LogSide = { items: what.item ? [what.item] : [], stacks: what.stack ? [what.stack] : [], coin: 0 };
  const base = { at: a.at, serverId: a.serverId, ref: a.key };
  return {
    buyer: { ...base, kind: 'stall_buy', with: a.seller, withName: a.sellerName, gave: { ...emptySide(), coin: total }, got: goods },
    seller: { ...base, kind: 'stall_sale', with: a.buyer, withName: a.buyerName, gave: goods, got: { ...emptySide(), coin: total - fee }, fee },
  };
}
