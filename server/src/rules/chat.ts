// Chat rules from docs/protokol.md. Pure functions, no Nakama dependency.
export const CHAT_MAX_LENGTH = 120; // (Öneri)
export const CHAT_MIN_INTERVAL_MS = 1000; // (Öneri)

/** Returns the cleaned message, or null if it should be dropped. */
export function sanitizeChat(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) return null;
  return Array.from(clean).slice(0, CHAT_MAX_LENGTH).join('');
}

export function canSpeak(lastSpokeAt: number | undefined, now: number): boolean {
  return lastSpokeAt === undefined || now - lastSpokeAt >= CHAT_MIN_INTERVAL_MS;
}
