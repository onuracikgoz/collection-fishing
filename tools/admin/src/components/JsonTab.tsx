import { useState } from 'react'
import { api } from '../api'
import type { Admin } from '../state'

const EXAMPLE = `{
  "sets": [{ "id": "lost_captain", "name": "Lost Captain" }],
  "items": [
    { "id": "mat_driftwood", "name": "Driftwood", "type": "material", "tier": "common", "setId": "lost_captain",
      "drop": { "bands": ["shore", "mid"] } },
    { "id": "sextant", "name": "Sextant", "type": "item", "tier": "epic", "setId": "lost_captain", "book": true,
      "recipe": { "grade": "normal", "stacks": [{ "defId": "mat_brass_scrap", "count": 3 }], "items": [], "drop": { "bands": ["deep"] }, "starter": 0 } }
  ]
}`

/** The JSON shortcut: many drafts at once (e.g. from the collection-set-generator skill), and a backup. */
export function JsonTab({ admin }: { admin: Admin }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState('')

  const run = async () => {
    let body: { items?: unknown; sets?: unknown }
    try {
      const v = JSON.parse(text)
      body = Array.isArray(v) ? { items: v } : v
    } catch (e) {
      setResult('JSON okunamadı: ' + (e instanceof Error ? e.message : String(e)))
      return
    }
    let out = ''
    const ok = await admin.run('JSON aktarıldı, taslaklar onay kuyruğunda', async (v) => {
      const r = await api.import(admin.conn, v, body)
      out = `${r.added} yeni taslak, ${r.updated} taslak güncellendi.${r.skipped.length ? ` Oyunda olduğu için atlananlar: ${r.skipped.join(', ')}` : ''}`
    })
    setResult(ok ? out : '')
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(admin.data.doc, null, 2) + '\n'], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `content-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="cards">
      <section className="card">
        <h2>JSON ile toplu ekleme</h2>
        <p className="muted">
          Liste halinde eşya ekler ya da taslakları doldurur; her biri yine onay kuyruğunda bekler. Görseller sonra ZIP ile gelir (aynı id). Oyundaki eşyalar burada değişmez, tek tek düzenlenir. Alanlar: <code>id, name, type, tier, setId, book, active, order, drop, recipe, bait</code>; olmayan
          alan varsayılan kalır. Bilinmeyen <code>sets</code> oluşturulur.
        </p>
        <textarea rows={16} value={text} placeholder={EXAMPLE} onChange={(e) => setText(e.target.value)} />
        <div className="actions">
          <button className="primary" disabled={!text.trim() || admin.busy} onClick={run}>
            Taslak olarak aktar
          </button>
          <label className="button ghost">
            Dosyadan oku…
            <input type="file" accept=".json,application/json" hidden onChange={async (e) => e.target.files?.[0] && setText(await e.target.files[0].text())} />
          </label>
          <button className="ghost" onClick={() => setText(EXAMPLE)}>
            Örnek
          </button>
        </div>
        {result ? <p>{result}</p> : null}
      </section>
      <section className="card">
        <h2>Yedek</h2>
        <p className="muted">Bütün içerik (eşyalar, setler, recipe'ler, av tablosu, sandıklar, görevler) tek JSON. Görseller dahil değil.</p>
        <button onClick={download}>İçeriği indir</button>
        {admin.data.errors.length > 0 ? (
          <>
            <h3 className="lvl-error">Kayıtlı içerikte sorun var</h3>
            <ul className="errors">
              {admin.data.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  )
}
