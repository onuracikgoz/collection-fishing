// Account transfer code (docs/protokol.md, Giriş). Pure functions.

/** 32 characters, no I or O, no 0 or 1: easy to read out and type. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A code from random bytes (any 0-255 values; 256 is a multiple of 32, so there is no bias). */
export function generateCode(bytes: number[], length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET.charAt(bytes[i] % CODE_ALPHABET.length);
  return out;
}

/** What the player typed → the stored form, or null if it cannot be a code. Spaces and dashes are ignored. */
export function normalizeCode(input: unknown, length: number): string | null {
  if (typeof input !== 'string') return null;
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== length) return null;
  for (let i = 0; i < code.length; i++) if (CODE_ALPHABET.indexOf(code.charAt(i)) < 0) return null;
  return code;
}

/** "ABCD-EFGH" for showing. */
export function formatCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return code.slice(0, half) + '-' + code.slice(half);
}

/** Times inside the window, oldest dropped. */
export function recent(times: number[], now: number, windowMs: number): number[] {
  return times.filter((t) => now - t < windowMs);
}

/** True if one more event fits under `max` per window. */
export function underLimit(times: number[], now: number, windowMs: number, max: number): boolean {
  return recent(times, now, windowMs).length < max;
}

export interface CodeRecord {
  owner: string;
  expiresAt: number;
}

export function isLive(rec: unknown, now: number): rec is CodeRecord {
  if (typeof rec !== 'object' || rec === null) return false;
  const r = rec as { owner?: unknown; expiresAt?: unknown };
  return typeof r.owner === 'string' && typeof r.expiresAt === 'number' && r.expiresAt > now;
}

/** transfer_code_redeem payload. */
export function parseRedeem(payload: string, length: number): { code: string; steamToken: string } | null {
  let body: { code?: unknown; steamToken?: unknown };
  try {
    body = JSON.parse(payload || '{}');
  } catch (_e) {
    return null;
  }
  const code = normalizeCode(body.code, length);
  if (code === null || typeof body.steamToken !== 'string' || body.steamToken.length === 0 || body.steamToken.length > 4096) return null;
  return { code, steamToken: body.steamToken };
}
