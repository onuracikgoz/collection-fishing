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
