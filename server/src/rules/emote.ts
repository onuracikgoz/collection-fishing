// Emotes (docs/tasarim/10-sosyal.md 13.2.2). Pure functions.

export interface EmoteConfig {
  /** Allowed emote ids. Friendly only (13+, no flirting). */
  list: string[];
  cooldownMs: number;
}

/** The emote id from a client message, or null if it is not allowed. */
export function parseEmote(body: unknown, cfg: EmoteConfig): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const e = (body as { emote?: unknown }).emote;
  return typeof e === 'string' && cfg.list.indexOf(e) >= 0 ? e : null;
}

export function canEmote(lastAt: number | undefined, now: number, cfg: EmoteConfig): boolean {
  return lastAt === undefined || now - lastAt >= cfg.cooldownMs;
}

export interface StatusConfig {
  status: { [id: string]: { tier: string } };
  statusCooldownMs: number;
}

/**
 * EMOTE_STATUS body: `{ emote: id }` to wear, `{ emote: null }` or `{ emote: "" }` to remove
 * (Unity's JsonUtility sends an empty string for null).
 * Returns `{ emote }` (null = remove), or `undefined` if the body is bad or the id unknown.
 */
export function parseStatus(body: unknown, cfg: StatusConfig): { emote: string | null } | undefined {
  if (typeof body !== 'object' || body === null || !('emote' in body)) return undefined;
  const e = (body as { emote?: unknown }).emote;
  if (e === null || e === '') return { emote: null };
  return typeof e === 'string' && Object.prototype.hasOwnProperty.call(cfg.status, e) ? { emote: e } : undefined;
}

/** Free emotes are open to all; the others need to be in the owned list. */
export function canWear(id: string, owned: string[], cfg: StatusConfig): boolean {
  const def = Object.prototype.hasOwnProperty.call(cfg.status, id) ? cfg.status[id] : undefined;
  if (!def) return false;
  return def.tier === 'free' || owned.indexOf(id) >= 0;
}

/** Owned list from storage: known, non-free ids only, no duplicates. */
export function normalizeOwned(value: unknown, cfg: StatusConfig): string[] {
  const ids = typeof value === 'object' && value !== null ? (value as { ids?: unknown }).ids : undefined;
  const out: string[] = [];
  if (!Array.isArray(ids)) return out;
  for (const id of ids) {
    if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(cfg.status, id) && cfg.status[id].tier !== 'free' && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}
