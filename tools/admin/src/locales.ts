// Texts shipped in the Unity build (client/Assets/Resources/Locales/<lang>.json, flat key → text).
// The Translations tab lists their keys; the server only stores what is changed or added.
const files = import.meta.glob('../../../client/Assets/Resources/Locales/*.json', { eager: true, import: 'default' }) as Record<string, unknown>

export const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'ru', 'pt-BR', 'zh-CN', 'ja', 'ko', 'pl'] as const
export const LANG_NAME: Record<string, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  ru: 'Русский',
  'pt-BR': 'Português (Brasil)',
  'zh-CN': '简体中文',
  ja: '日本語',
  ko: '한국어',
  pl: 'Polski',
}

export type Strings = Record<string, string>

/** Bundled texts per language; a language without a file (or with an empty one) is `{}`. */
export const BUNDLED: Record<string, Strings> = (() => {
  const out: Record<string, Strings> = {}
  for (const path in files) {
    const lang = path.replace(/^.*\//, '').replace(/\.json$/, '')
    const v = files[path]
    if (!(LANGS as readonly string[]).includes(lang) || typeof v !== 'object' || v === null) continue
    const flat: Strings = {}
    for (const [k, t] of Object.entries(v as Record<string, unknown>)) if (typeof t === 'string') flat[k] = t
    out[lang] = flat
  }
  return out
})()

/** Named placeholders such as `{count}`, sorted (same check as the server and the client). */
export function placeholders(text: string): string {
  return [...new Set([...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]))].sort().join(',')
}

/** Every key the game knows: bundled in any language, or already on the server. */
export function allKeys(server: Record<string, Strings>): string[] {
  const keys = new Set<string>()
  for (const l in BUNDLED) for (const k in BUNDLED[l]) keys.add(k)
  for (const l in server) for (const k in server[l]) keys.add(k)
  return [...keys].sort()
}

/** What the player would see: the server text, else the bundled one, else ''. */
export function effective(lang: string, key: string, server: Strings): string {
  return server[key] ?? BUNDLED[lang]?.[key] ?? ''
}
