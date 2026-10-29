// Pet stalls (docs/tasarim/09-ekonomi-pazar.md 12.3, docs/protokol.md Pazar). Pure functions.
import { sanitizeChat } from './chat';

export interface MarketConfig {
  minLevel: number;
  maxEntries: number;
  maxPrice: number;
  feePct: number;
  ttlMs: number;
  titleMax: number;
  columns: number;
  rows: number;
  spacing: number;
  areaRadius: number;
  interactRadius: number;
  topCount: number;
}

export interface Spot {
  id: number;
  x: number;
  y: number;
}

/** A grid of stall spots centred on the market point; spots on blocked tiles are dropped. */
export function buildSpots(center: { x: number; y: number }, cfg: MarketConfig, walkable: (x: number, y: number) => boolean): Spot[] {
  const out: Spot[] = [];
  const x0 = center.x - ((cfg.columns - 1) * cfg.spacing) / 2;
  const y0 = center.y - ((cfg.rows - 1) * cfg.spacing) / 2;
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.columns; c++) {
      const x = x0 + c * cfg.spacing;
      const y = y0 + r * cfg.spacing;
      if (walkable(x, y)) out.push({ id: r * cfg.columns + c, x, y });
    }
  }
  return out;
}

/** The free spot closest to (x, y), or null when all are taken. */
export function nearestFreeSpot(spots: Spot[], taken: { [spotId: number]: true }, x: number, y: number): Spot | null {
  let best: Spot | null = null;
  let bestD = Infinity;
  for (const s of spots) {
    if (taken[s.id]) continue;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export interface ListedItem {
  instanceId: string;
  price: number;
}

/** A stack for sale; `price` is per unit. */
export interface ListedStack {
  defId: string;
  count: number;
  price: number;
}

export interface Listing {
  title: string;
  items: ListedItem[];
  stacks: ListedStack[];
}

export type OpenReason = 'BAD_REQUEST' | 'TOO_MANY' | 'BAD_PRICE';

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** STALL_OPEN body → listing, or why not. Ids and counts are checked against what the player owns elsewhere. */
export function parseListing(body: unknown, cfg: MarketConfig): { ok: true; listing: Listing } | { ok: false; reason: OpenReason } {
  if (typeof body !== 'object' || body === null) return { ok: false, reason: 'BAD_REQUEST' };
  const b = body as { title?: unknown; items?: unknown; stacks?: unknown };
  const items = b.items === undefined ? [] : b.items;
  const stacks = b.stacks === undefined ? [] : b.stacks;
  if (!Array.isArray(items) || !Array.isArray(stacks)) return { ok: false, reason: 'BAD_REQUEST' };
  if (items.length + stacks.length > cfg.maxEntries) return { ok: false, reason: 'TOO_MANY' };
  if (items.length + stacks.length === 0) return { ok: false, reason: 'BAD_REQUEST' };
  if (b.title !== undefined && typeof b.title !== 'string') return { ok: false, reason: 'BAD_REQUEST' };
  // An empty title is fine; sanitizeChat rejects empty text, so only filter a written one.
  const raw = b.title === undefined ? '' : b.title.trim();
  const title = raw === '' ? '' : sanitizeChat(raw);
  if (title === null) return { ok: false, reason: 'BAD_REQUEST' };
  const out: Listing = { title: Array.from(title).slice(0, cfg.titleMax).join(''), items: [], stacks: [] };
  for (const it of items) {
    if (typeof it !== 'object' || it === null) return { ok: false, reason: 'BAD_REQUEST' };
    const { instanceId, price } = it as { instanceId?: unknown; price?: unknown };
    if (typeof instanceId !== 'string' || instanceId.length === 0 || instanceId.length > 64) return { ok: false, reason: 'BAD_REQUEST' };
    if (out.items.some((x) => x.instanceId === instanceId)) return { ok: false, reason: 'BAD_REQUEST' };
    if (!isInt(price) || price < 1 || price > cfg.maxPrice) return { ok: false, reason: 'BAD_PRICE' };
    out.items.push({ instanceId, price });
  }
  for (const st of stacks) {
    if (typeof st !== 'object' || st === null) return { ok: false, reason: 'BAD_REQUEST' };
    const { defId, count, price } = st as { defId?: unknown; count?: unknown; price?: unknown };
    if (typeof defId !== 'string' || defId.length === 0 || defId.length > 64) return { ok: false, reason: 'BAD_REQUEST' };
    if (out.stacks.some((x) => x.defId === defId)) return { ok: false, reason: 'BAD_REQUEST' };
    if (!isInt(count) || count < 1 || count > 1_000_000) return { ok: false, reason: 'BAD_REQUEST' };
    if (!isInt(price) || price < 1 || price * count > cfg.maxPrice) return { ok: false, reason: 'BAD_PRICE' };
    out.stacks.push({ defId, count, price });
  }
  return { ok: true, listing: out };
}

/** The sale fee, taken from the seller: 5 % rounded up, nothing on a 1 Coin sale. */
export function feeOf(total: number, cfg: MarketConfig): number {
  return total > 1 ? Math.min(total - 1, Math.ceil(total * cfg.feePct)) : 0;
}

export interface BuyRequest {
  owner: string;
  /** A Float item... */
  instanceId?: string;
  /** ...or a stack with how many. */
  defId?: string;
  count?: number;
}

export function parseBuy(body: unknown): BuyRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { userId?: unknown; instanceId?: unknown; defId?: unknown; count?: unknown };
  const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
  if (!id(b.userId)) return null;
  // Unity sends every field, empty or 0 when unused.
  if (id(b.instanceId)) return { owner: b.userId, instanceId: b.instanceId };
  if (id(b.defId) && isInt(b.count) && b.count >= 1 && b.count <= 1_000_000) return { owner: b.userId, defId: b.defId, count: b.count };
  return null;
}

export type BuyPlan =
  | { ok: true; kind: 'item'; instanceId: string; total: number; rest: Listing }
  | { ok: true; kind: 'stack'; defId: string; count: number; total: number; rest: Listing }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_ENOUGH' };

/** What a buy takes out of the listing and costs. Does not change the listing. */
export function planBuy(listing: Listing, req: BuyRequest): BuyPlan {
  if (req.instanceId !== undefined) {
    const it = listing.items.filter((x) => x.instanceId === req.instanceId)[0];
    if (!it) return { ok: false, reason: 'NOT_FOUND' };
    return { ok: true, kind: 'item', instanceId: it.instanceId, total: it.price, rest: { ...listing, items: listing.items.filter((x) => x.instanceId !== it.instanceId) } };
  }
  const st = listing.stacks.filter((x) => x.defId === req.defId)[0];
  if (!st) return { ok: false, reason: 'NOT_FOUND' };
  const count = req.count || 0;
  if (count > st.count) return { ok: false, reason: 'NOT_ENOUGH' };
  // Match by key, not by object: Nakama hands the match state back as fresh objects, so identity checks fail there.
  const stacks = listing.stacks.map((x) => (x.defId === st.defId ? { ...x, count: x.count - count } : x)).filter((x) => x.count > 0);
  return { ok: true, kind: 'stack', defId: st.defId, count, total: st.price * count, rest: { ...listing, stacks } };
}

/** An entry as shown beside the pet. `tier` is empty for stacks. */
export interface TopEntry {
  defId: string;
  tier: string;
  count: number;
  price: number;
}

/** The first `n` entries: items first, then stacks. `info` gives each item's defId and tier. */
export function topEntries(listing: Listing, info: { [instanceId: string]: { defId: string; tier: string } }, n: number): TopEntry[] {
  const out: TopEntry[] = [];
  for (const it of listing.items) {
    if (out.length >= n) break;
    const i = info[it.instanceId];
    if (i) out.push({ defId: i.defId, tier: i.tier, count: 1, price: it.price });
  }
  for (const st of listing.stacks) {
    if (out.length >= n) break;
    out.push({ defId: st.defId, tier: '', count: st.count, price: st.price });
  }
  return out;
}
