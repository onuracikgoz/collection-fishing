import { useEffect, useState } from 'react'
import { api, type LocaleLang } from '../api'
import { LANG_NAME, LANGS } from '../locales'
import type { Admin } from '../state'

/** The text key of an item's story in the language files (docs/araclar/dil-destegi.md). */
export const storyKey = (itemId: string) => `item.story.${itemId}`

/** One story per language, stored as a text of that language (not in the content doc, so it needs no approval). */
export function Story({ admin, itemId }: { admin: Admin; itemId: string }) {
  const [langs, setLangs] = useState<Record<string, LocaleLang> | null>(null)
  const [lang, setLang] = useState('en')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const key = storyKey(itemId)

  const load = async () => {
    try {
      setLangs((await api.localeGet(admin.conn)).langs)
    } catch (e) {
      admin.setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  const saved = langs?.[lang]
  useEffect(() => {
    setText(saved?.strings[key] ?? '')
  }, [lang, itemId, saved?.version, saved?.hash]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!saved) return
    setBusy(true)
    try {
      const next = { ...saved.strings }
      if (text.trim() === '') delete next[key]
      else next[key] = text.trim()
      await api.localeSave(admin.conn, lang, saved.version, next)
      admin.setNotice({ kind: 'ok', text: `Hikaye kaydedildi (${LANG_NAME[lang]}).` })
    } catch (e) {
      admin.setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
      await load()
    }
  }

  const has = (l: string) => (langs?.[l]?.strings[key] ?? '') !== ''
  return (
    <>
      <h3>Hikaye</h3>
      <p className="muted small">
        Eşyayı incelerken görünür. Dil başına ayrı yazılır, onay beklemez (kaydedince oyuncular bir sonraki girişte görür). Dilde hikaye yoksa İngilizcesi gösterilir. Metin anahtarı: <code>{key}</code>
      </p>
      <div className="row">
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAME[l]} ({l}){has(l) ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <button disabled={busy || !saved || text.trim() === (saved.strings[key] ?? '')} onClick={save}>
          Hikayeyi kaydet
        </button>
      </div>
      <textarea rows={4} maxLength={600} value={text} placeholder="Bu eşyanın hikayesi…" onChange={(e) => setText(e.target.value)} />
    </>
  )
}
