// Game texts per language (docs/protokol.md, Dil). The client carries tr / en in its build; the
// server keeps overrides and the other languages so a sentence can change without a new build.
// Pure checks only; storage is in match/locale.ts.

/** Language codes the game knows (Steam's most used). The first two ship in the client build. */
export const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'ru', 'pt-BR', 'zh-CN', 'ja', 'ko', 'pl'] as const;
export type Lang = (typeof LANGS)[number];

/** Dotted ids such as `settings.language` or `market.err.stall_full`. */
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,95}$/;
export const MAX_KEYS = 6000;
export const MAX_TEXT = 2000;

export interface Strings {
  [key: string]: string;
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).indexOf(v) >= 0;
}

/** Flat key → text map; returns the problems, empty when fine. */
export function validateStrings(v: unknown): string[] {
  const errors: string[] = [];
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return ['strings must be an object of key: text'];
  const keys = Object.keys(v as object);
  if (keys.length > MAX_KEYS) errors.push(`strings: at most ${MAX_KEYS} keys`);
  for (const k of keys.slice(0, MAX_KEYS)) {
    const t = (v as { [k: string]: unknown })[k];
    if (!KEY_PATTERN.test(k)) errors.push(`key "${k.slice(0, 40)}": use lower case letters, digits, "_", "." and "-" (1-96)`);
    else if (typeof t !== 'string') errors.push(`${k}: the text must be a string`);
    else if (t.length > MAX_TEXT) errors.push(`${k}: longer than ${MAX_TEXT} characters`);
  }
  return errors.slice(0, 20);
}

/** Named placeholders such as `{count}` in a text, sorted and unique. */
export function placeholders(text: string): string[] {
  const out: string[] = [];
  const re = /\{([A-Za-z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) if (out.indexOf(m[1]) < 0) out.push(m[1]);
  return out.sort();
}

/** Same placeholders in both texts (a translation must not lose or invent one). */
export function samePlaceholders(a: string, b: string): boolean {
  return placeholders(a).join(',') === placeholders(b).join(',');
}

/** Text with keys in order, so the same strings always hash the same. */
export function canonical(strings: Strings): string {
  const keys = Object.keys(strings).sort();
  return JSON.stringify(keys.map((k) => [k, strings[k]]));
}
