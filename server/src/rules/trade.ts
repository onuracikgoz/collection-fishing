// Safe trade window (docs/tasarim/07-kopya-envanter.md 9.1, docs/protokol.md Takas). Pure functions.
import { BagConfig, BagSummary, slotsUsed } from './bag';

export interface TradeConfig {
  /** Items plus stacks per side. */
  maxSlots: number;
  /** Tiles; both players must be this close at the offer and while the window is open. */
  maxDistance: number;
  inviteMs: number;
  /** Both locked, then this long before Confirm is accepted. */
  countdownMs: number;
  /** An open window is cancelled after this long. */
  openTimeoutMs: number;
  /** Per player, between offers. */
  offerCooldownMs: number;
}

export interface Offer {
  /** Float item instance ids from the bag. */
  items: string[];
  stacks: { defId: string; count: number }[];
  coin: number;
}

export const EMPTY_OFFER: Offer = { items: [], stacks: [], coin: 0 };

const MAX_COIN = 1_000_000_000;

/** TRADE_SET body → offer, or null if it is malformed. `TOO_MANY` is told apart by the caller via `slots`. */
export function parseOffer(body: unknown): Offer | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { items?: unknown; stacks?: unknown; coin?: unknown };
  const items = b.items === undefined ? [] : b.items;
  const stacks = b.stacks === undefined ? [] : b.stacks;
  const coin = b.coin === undefined ? 0 : b.coin;
  if (!Array.isArray(items) || !Array.isArray(stacks)) return null;
  if (typeof coin !== 'number' || !Number.isInteger(coin) || coin < 0 || coin > MAX_COIN) return null;
  const out: Offer = { items: [], stacks: [], coin };
  if (items.length > 64 || stacks.length > 64) return null;
  for (const id of items) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 64 || out.items.indexOf(id) >= 0) return null;
    out.items.push(id);
  }
  for (const s of stacks) {
    if (typeof s !== 'object' || s === null) return null;
    const { defId, count } = s as { defId?: unknown; count?: unknown };
    if (typeof defId !== 'string' || defId.length === 0 || defId.length > 64) return null;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 1_000_000) return null;
    if (out.stacks.some((x) => x.defId === defId)) return null;
    out.stacks.push({ defId, count });
  }
  return out;
}

export function slots(o: Offer): number {
  return o.items.length + o.stacks.length;
}

export type Phase = 'invite' | 'open';

export interface Session {
  id: string;
  /** The player who offered. */
  a: string;
  /** The player who was offered. */
  b: string;
  phase: Phase;
  /** Invite or window expiry, ms. */
  expiresAt: number;
  offers: { [userId: string]: Offer };
  locked: { [userId: string]: boolean };
  /** When the second lock was placed, else null. */
  lockedAt: number | null;
  confirmed: { [userId: string]: boolean };
}

export function newSession(id: string, from: string, to: string, now: number, cfg: TradeConfig): Session {
  return {
    id,
    a: from,
    b: to,
    phase: 'invite',
    expiresAt: now + cfg.inviteMs,
    offers: { [from]: EMPTY_OFFER, [to]: EMPTY_OFFER },
    locked: { [from]: false, [to]: false },
    lockedAt: null,
    confirmed: { [from]: false, [to]: false },
  };
}

export function otherOf(s: Session, userId: string): string {
  return userId === s.a ? s.b : s.a;
}

export function accept(s: Session, now: number, cfg: TradeConfig): void {
  s.phase = 'open';
  s.expiresAt = now + cfg.openTimeoutMs;
}

function resetLocks(s: Session): void {
  s.locked[s.a] = false;
  s.locked[s.b] = false;
  s.confirmed[s.a] = false;
  s.confirmed[s.b] = false;
  s.lockedAt = null;
}

/** A side changed its content: both locks open, confirmations are gone. */
export function setOffer(s: Session, userId: string, offer: Offer): void {
  s.offers[userId] = offer;
  resetLocks(s);
}

export function setLock(s: Session, userId: string, lock: boolean, now: number): void {
  if (!lock) {
    if (s.locked[userId]) resetLocks(s);
    return;
  }
  s.locked[userId] = true;
  if (s.locked[s.a] && s.locked[s.b] && s.lockedAt === null) s.lockedAt = now;
}

/** Ms until Confirm is accepted: null while not both locked, 0 when it can be pressed now. */
export function confirmInMs(s: Session, now: number, cfg: TradeConfig): number | null {
  if (s.lockedAt === null) return null;
  return Math.max(0, s.lockedAt + cfg.countdownMs - now);
}

/** Records a confirmation. `ready` once both confirmed. A confirm before the countdown ends is ignored. */
export function confirm(s: Session, userId: string, now: number, cfg: TradeConfig): 'ignored' | 'waiting' | 'ready' {
  const wait = confirmInMs(s, now, cfg);
  if (wait === null || wait > 0) return 'ignored';
  s.confirmed[userId] = true;
  return s.confirmed[s.a] && s.confirmed[s.b] ? 'ready' : 'waiting';
}

/** What one side owns right now, read by the caller from storage. Only bag items belong in `items`. */
export interface Holdings {
  userId: string;
  items: { [instanceId: string]: true };
  stacks: { [defId: string]: number };
  coin: number;
  bag: BagSummary;
}

export interface SidePlan {
  userId: string;
  giveItems: string[];
  giveStacks: { defId: string; count: number }[];
  getItems: string[];
  getStacks: { defId: string; count: number }[];
  /** Coin change: what comes in minus what goes out. */
  coinDelta: number;
  stacksAfter: { [defId: string]: number };
  itemsAfter: number;
}

export type TradePlan = { ok: true; a: SidePlan; b: SidePlan } | { ok: false; reason: 'ITEM_GONE' | 'NOT_ENOUGH' | 'BAG_FULL'; userId: string };

/** Checks both offers against what each side owns now and plans the swap. Does not change its inputs. */
export function planTrade(a: Holdings, offerA: Offer, b: Holdings, offerB: Offer, bagCfg: BagConfig): TradePlan {
  for (const [h, o] of [[a, offerA], [b, offerB]] as [Holdings, Offer][]) {
    for (const id of o.items) if (!h.items[id]) return { ok: false, reason: 'ITEM_GONE', userId: h.userId };
    for (const s of o.stacks) if ((h.stacks[s.defId] || 0) < s.count) return { ok: false, reason: 'NOT_ENOUGH', userId: h.userId };
    if (h.coin < o.coin) return { ok: false, reason: 'NOT_ENOUGH', userId: h.userId };
  }
  const side = (h: Holdings, give: Offer, get: Offer): SidePlan => {
    const stacksAfter: { [defId: string]: number } = { ...h.stacks };
    for (const s of give.stacks) stacksAfter[s.defId] = (stacksAfter[s.defId] || 0) - s.count;
    for (const s of get.stacks) stacksAfter[s.defId] = (stacksAfter[s.defId] || 0) + s.count;
    for (const defId in stacksAfter) if (stacksAfter[defId] <= 0) delete stacksAfter[defId];
    return {
      userId: h.userId,
      giveItems: give.items,
      giveStacks: give.stacks,
      getItems: get.items,
      getStacks: get.stacks,
      coinDelta: get.coin - give.coin,
      stacksAfter,
      // Every received item counts as a bag slot here, even if it later goes to a book slot.
      itemsAfter: h.bag.items - give.items.length + get.items.length,
    };
  };
  const pa = side(a, offerA, offerB);
  const pb = side(b, offerB, offerA);
  for (const p of [pa, pb]) {
    if (slotsUsed({ items: p.itemsAfter, stacks: p.stacksAfter }, bagCfg) > bagCfg.slots) return { ok: false, reason: 'BAG_FULL', userId: p.userId };
  }
  return { ok: true, a: pa, b: pb };
}
