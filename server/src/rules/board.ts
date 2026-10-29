// The market board: elmasla (with diamonds) paid ads for a stall (docs/tasarim/09-ekonomi-pazar.md,
// docs/protokol.md Pazar Panosu). Pure functions.

export interface BoardConfig {
  /** Diamonds an ad costs. */
  priceDiamonds: number;
  /** An ad lasts this long, or until its stall ends. */
  ttlMs: number;
  /** Ads on the board of one server at the same time. */
  slots: number;
  /** Entries of the stall the ad may pick out. */
  maxHighlights: number;
}

export type AdRequest = { action: 'set'; highlights: string[] } | { action: 'remove' };

/**
 * BOARD_AD body. `highlights` are stall entries: a Float item by `instanceId`, a stack by `defId`.
 * Unity sends every field, empty when unused, so an empty id is "not this one".
 */
export function parseAdRequest(body: unknown, cfg: BoardConfig): AdRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { action?: unknown; highlights?: unknown };
  if (b.action === 'remove') return { action: 'remove' };
  if (b.action !== 'set') return null;
  const list = b.highlights === undefined ? [] : b.highlights;
  if (!Array.isArray(list) || list.length > cfg.maxHighlights) return null;
  const out: string[] = [];
  for (const h of list) {
    if (typeof h !== 'object' || h === null) return null;
    const { instanceId, defId } = h as { instanceId?: unknown; defId?: unknown };
    const key = typeof instanceId === 'string' && instanceId !== '' ? instanceId : typeof defId === 'string' && defId !== '' ? defId : '';
    if (key === '' || key.length > 64) return null;
    if (out.indexOf(key) < 0) out.push(key);
  }
  return { action: 'set', highlights: out };
}

export type AdPlan = { ok: true; charge: number } | { ok: false; reason: 'BOARD_FULL' | 'NOT_ENOUGH_DIAMOND' };

/** An ad already running is changed for free; a new one needs a free slot and the price. */
export function planAd(hasAd: boolean, adsNow: number, diamonds: number, cfg: BoardConfig): AdPlan {
  if (hasAd) return { ok: true, charge: 0 };
  if (adsNow >= cfg.slots) return { ok: false, reason: 'BOARD_FULL' };
  if (diamonds < cfg.priceDiamonds) return { ok: false, reason: 'NOT_ENOUGH_DIAMOND' };
  return { ok: true, charge: cfg.priceDiamonds };
}

/** Keys the stall still has, in the order the owner picked them. */
export function liveHighlights(highlights: string[], items: { instanceId: string }[], stacks: { defId: string }[]): string[] {
  return highlights.filter((h) => items.some((i) => i.instanceId === h) || stacks.some((s) => s.defId === h));
}
