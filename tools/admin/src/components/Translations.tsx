import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type LocaleLang } from '../api'
import { BUNDLED, LANG_NAME, LANGS, allKeys, effective, placeholders, type Strings } from '../locales'
import type { Admin } from '../state'

const SHIPPED = ['tr', 'en'] as const

/** Game texts per language. tr / en live in the Unity build; the server's texts win over them. */
export function Translations({ admin }: { admin: Admin }) {
  const [langs, setLangs] = useState<Record<string, LocaleLang> | null>(null)
  const [lang, setLang] = useState<string>('en')
  const [draft, setDraft] = useState<Strings>({})
  const [search, setSearch] = useState('')
  const [only, setOnly] = useState<'all' | 'missing' | 'changed' | 'problems'>('all')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.localeGet(admin.conn)
      setLangs(r.langs)
      return r.langs
    } catch (e) {
      admin.setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin.conn])

  useEffect(() => {
    void load()
  }, [load])

  const saved = langs?.[lang]
  useEffect(() => {
    setDraft({ ...(saved?.strings ?? {}) })
  }, [lang, saved?.version, saved?.hash]) // eslint-disable-line react-hooks/exhaustive-deps

  const keys = useMemo(() => allKeys(Object.fromEntries(Object.entries(langs ?? {}).map(([l, v]) => [l, v.strings]))), [langs])
  const bundledHere = BUNDLED[lang] ?? {}
  const source = (k: string) => BUNDLED.tr?.[k] ?? langs?.tr?.strings[k] ?? ''
  const english = (k: string) => BUNDLED.en?.[k] ?? langs?.en?.strings[k] ?? ''
  const shown = (k: string) => draft[k] ?? bundledHere[k] ?? ''
  const problem = (k: string) => {
    const t = shown(k)
    return t !== '' && source(k) !== '' && placeholders(t) !== placeholders(source(k))
  }
  const dirty = JSON.stringify(Object.entries(draft).filter(([, t]) => t.trim() !== '').sort()) !== JSON.stringify(Object.entries(saved?.strings ?? {}).sort())

  const rows = keys.filter((k) => {
    if (search && !(k.includes(search.toLowerCase()) || shown(k).toLowerCase().includes(search.toLowerCase()) || english(k).toLowerCase().includes(search.toLowerCase()))) return false
    if (only === 'missing') return shown(k) === ''
    if (only === 'changed') return draft[k] !== undefined && draft[k] !== ''
    if (only === 'problems') return problem(k)
    return true
  })
  const missing = keys.filter((k) => shown(k) === '').length
  const problems = keys.filter(problem).length

  const save = async () => {
    if (!saved) return
    setBusy(true)
    try {
      const clean: Strings = {}
      for (const [k, t] of Object.entries(draft)) if (t.trim() !== '') clean[k] = t
      const r = await api.localeSave(admin.conn, lang, saved.version, clean)
      admin.setNotice({ kind: 'ok', text: `${LANG_NAME[lang]}: ${r.keys} metin kaydedildi. Oyuncular bir sonraki girişte görür.` })
      await load()
    } catch (e) {
      admin.setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const download = (name: string, data: Strings) => {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /** The file to hand to a translator: every key with its English text (Turkish where English is missing). */
  const forTranslator = () => {
    const out: Strings = {}
    for (const k of keys) out[k] = english(k) || source(k)
    download(`translate-to-${lang}.json`, out)
  }
  /** What the game shows now in this language (bundled + server), i.e. a full backup of it. */
  const current = () => {
    const out: Strings = {}
    for (const k of keys) {
      const t = effective(lang, k, draft)
      if (t !== '') out[k] = t
    }
    download(`${lang}.json`, out)
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      const v = JSON.parse(await file.text()) as Record<string, unknown>
      if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('Düz bir { "anahtar": "metin" } nesnesi olmalı.')
      const next = { ...draft }
      let n = 0
      let bad = 0
      for (const [k, t] of Object.entries(v)) {
        if (typeof t !== 'string' || t.trim() === '') continue
        if (source(k) !== '' && placeholders(t) !== placeholders(source(k))) bad++
        next[k] = t
        n++
      }
      setDraft(next)
      admin.setNotice({ kind: bad > 0 ? 'error' : 'ok', text: `${n} metin okundu${bad > 0 ? `, ${bad} tanesinin {yer tutucuları} Türkçesiyle uyuşmuyor ("Sorunlu" filtresi). İstemci bunları kullanmaz` : ''}. Kaydet'e basana kadar yazılmadı.` })
    } catch (e) {
      admin.setNotice({ kind: 'error', text: 'JSON okunamadı: ' + (e instanceof Error ? e.message : String(e)) })
    }
  }

  return (
    <section className="card">
      <h2>Çeviriler</h2>
      <p className="muted">
        Oyundaki yazılar anahtar → metin olarak tutulur. Türkçe ve İngilizce Unity build'inin içindedir; burada kaydettiğin metin build'i geçer ve oyuncuya bir sonraki girişte ulaşır (yeni build gerekmez). Eşya ve set adları, Tier adları, <code>Float</code> ve <code>Coin</code>
        İngilizce kalır. {'{yer_tutucular}'} çeviride aynen korunmalı.
      </p>
      {keys.length === 0 ? (
        <p className="lvl-warn">Henüz anahtar yok: client'ın <code>Assets/Resources/Locales/*.json</code> dosyaları repoda değil ya da boş.</p>
      ) : null}
      <div className="filters">
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAME[l]} ({l}){(SHIPPED as readonly string[]).includes(l) ? '' : ' — çeviri bekliyor'}
            </option>
          ))}
        </select>
        <input placeholder="Ara (anahtar ya da metin)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)}>
          <option value="all">Hepsi ({keys.length})</option>
          <option value="missing">Çevrilmemiş ({missing})</option>
          <option value="changed">Sunucuda değişen</option>
          <option value="problems">Sorunlu yer tutucu ({problems})</option>
        </select>
        <span className="grow" />
        <button onClick={forTranslator}>Çeviri için indir</button>
        <button onClick={current}>Şu anki hali indir</button>
        <label className="button ghost">
          JSON yükle…
          <input type="file" accept=".json,application/json" hidden onChange={(e) => (void upload(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        <button className="primary" disabled={busy || !dirty || !saved} onClick={save}>
          Kaydet
        </button>
      </div>
      <table className="list">
        <thead>
          <tr>
            <th>Anahtar</th>
            <th>Türkçe</th>
            <th>English</th>
            <th>{LANG_NAME[lang]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 400).map((k) => (
            <tr key={k}>
              <td>
                <code>{k}</code>
              </td>
              <td className="muted small">{source(k)}</td>
              <td className="muted small">{english(k)}</td>
              <td>
                <input
                  style={{ width: '100%', minWidth: 260 }}
                  value={shown(k)}
                  placeholder={bundledHere[k] === undefined ? '—' : ''}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                />
                {problem(k) ? <div className="lvl-error small">Yer tutucular Türkçesiyle aynı olmalı: {placeholders(source(k)) || '(yok)'}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 400 ? <p className="muted small">İlk 400 satır gösteriliyor; aramayı daralt ({rows.length} eşleşme).</p> : null}
    </section>
  )
}
