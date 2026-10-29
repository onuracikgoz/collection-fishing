// Whisper, the personal info filter and player reports (docs/tasarim/10-sosyal.md 13.1.2,
// docs/protokol.md Fısıltı). Pure functions, no Nakama dependency.
import { sanitizeChat } from './chat';

export interface WhisperConfig {
  /** Strangers may only whisper from a stall and at this level or above. */
  strangerMinLevel: number;
  perWindow: number;
  windowMs: number;
  /** Phone numbers: this many digits or more in a run. */
  phoneDigits: number;
}

const SOCIAL = /\b(instagram|insta|snapchat|snap|discord|tiktok|whatsapp|telegram|facebook|twitter)\b\s*[:@]?\s*\S+/gi;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const URL = /(https?:\/\/|www\.)\S+/gi;
const DOMAIN = /\b[\w-]+\.(com|net|org|io|gg|me|tr|co|xyz|tv|app|link|ly|biz|info)(\.[a-z]{2})?(\/\S*)?\b/gi;
const HANDLE = /@\w{2,}/g;
const NUMBER_RUN = /\+?\d[\d\s().-]*\d/g;

/** Masks phone numbers, e-mail addresses, links and social handles. `masked` tells whether anything changed. */
export function maskPersonal(text: string, cfg: { phoneDigits: number }): { text: string; masked: boolean } {
  let out = text
    .replace(SOCIAL, (m) => m.replace(/\s*[:@]?\s*\S+$/, ' ***'))
    .replace(EMAIL, '***')
    .replace(URL, '***')
    .replace(DOMAIN, '***')
    .replace(HANDLE, '***');
  out = out.replace(NUMBER_RUN, (m) => ((m.match(/\d/g) || []).length >= cfg.phoneDigits ? '***' : m));
  return { text: out, masked: out !== text };
}

export interface WhisperRequest {
  /** userId or username; one of them is set. */
  to: string;
  byName: boolean;
  text: string;
  /** 'stall': written from a pet stall's window (lets a stranger write). */
  context: '' | 'stall';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseWhisper(payload: string): WhisperRequest | null {
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(payload || '{}');
  } catch (_e) {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const text = sanitizeChat(v.text);
  if (text === null) return null;
  const context = v.context === 'stall' ? 'stall' : '';
  if (typeof v.userId === 'string' && UUID.test(v.userId)) return { to: v.userId, byName: false, text, context };
  if (typeof v.username === 'string' && v.username.length > 0 && v.username.length <= 32) return { to: v.username, byName: true, text, context };
  return null;
}

export interface WhisperFacts {
  friends: boolean;
  /** The receiver blocked the sender. */
  blockedBySender: boolean;
  blockedByTarget: boolean;
  targetPmOff: boolean;
  targetHasStall: boolean;
  senderLevel: number;
  context: '' | 'stall';
}

export type WhisperRefusal = 'YOU_BLOCKED' | 'NOT_ALLOWED' | 'LEVEL_TOO_LOW';

/**
 * Who may write to whom: friends always (unless blocked); a stranger only from the receiver's stall,
 * at level 10, and only if the receiver has not turned whispers off. A block on the receiver's side
 * reads as NOT_ALLOWED, so it is not given away.
 */
export function whisperRefusal(f: WhisperFacts, cfg: WhisperConfig): WhisperRefusal | null {
  if (f.blockedBySender) return 'YOU_BLOCKED';
  if (f.blockedByTarget) return 'NOT_ALLOWED';
  if (f.friends) return null;
  if (f.targetPmOff || f.context !== 'stall' || !f.targetHasStall) return 'NOT_ALLOWED';
  if (f.senderLevel < cfg.strangerMinLevel) return 'LEVEL_TOO_LOW';
  return null;
}

export const REPORT_REASONS = ['spam', 'abuse', 'scam', 'personal_info', 'cheating', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportRequest {
  userId: string;
  reason: ReportReason;
  /** Free text from the reporter, cut to 300 characters. */
  note: string;
  /** The message being reported, if any, cut to 200 characters. */
  text: string;
}

export function parseReport(payload: string): ReportRequest | null {
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(payload || '{}');
  } catch (_e) {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  if (typeof v.userId !== 'string' || !UUID.test(v.userId)) return null;
  if (typeof v.reason !== 'string' || (REPORT_REASONS as readonly string[]).indexOf(v.reason) < 0) return null;
  const cut = (x: unknown, n: number) => (typeof x === 'string' ? Array.from(x).slice(0, n).join('') : '');
  return { userId: v.userId, reason: v.reason as ReportReason, note: cut(v.note, 300), text: cut(v.text, 200) };
}
