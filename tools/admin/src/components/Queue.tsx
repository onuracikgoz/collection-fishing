import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { checkArt, type ArtReport } from '../artCheck'
import { TIERS, ITEM_TYPES, type ContentItem } from '../content'
import { decodePng, readZip, type ZipImage } from '../images'
import { PALETTE, type Admin } from '../state'
import { ItemEditor } from './ItemEditor'
import { Report, TIER_LABEL, TYPE_LABEL, Thumb } from './bits'

interface Upload {
  img: ZipImage
  report?: ArtReport
  state: 'new' | 'replace' | 'same' | 'skip'
  result?: string
}

/** ZIP from Item Art Studio (only PNGs, file name = item id) → drafts → approve one by one. */
export function Queue({ admin }: { admin: Admin }) {
  const [uploads, setUploads] = useState<Upload[] | null>(null)
  const [bad, setBad] = useState<string[]>([])
  const [setId, setSetId] = useState('')
  const [type, setType] = useState<string>('item')
  const [tier, setTier] = useState<string>('common')
  const [replaceLive, setReplaceLive] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const drafts = useMemo(() => {
    const order = Object.fromEntries(admin.data.doc.sets.map((s) => [s.id, s.order]))
    return admin.data.doc.items
      .filter((it) => it.status === 'draft')
      .sort((a, b) => (order[a.setId ?? ''] ?? -1) - (order[b.setId ?? ''] ?? -1) || a.order - b.order || a.updatedAt - b.updatedAt)
  }, [admin.data])
  const waiting = drafts.filter((d) => !skipped.includes(d.id)).concat(drafts.filter((d) => skipped.includes(d.id)))
  const current: ContentItem | undefined = waiting[0]

  useEffect(() => admin.loadArt(drafts.map((d) => d.id)), [admin, drafts])

  const onZip = async (file: File) => {
    const { images, bad } = readZip(new Uint8Array(await file.arrayBuffer()))
    setBad(bad)
    const list: Upload[] = images.map((img) => {
      const it = admin.itemById(img.id)
      return { img, state: !it ? 'new' : it.status === 'draft' ? 'replace' : 'same' }
    })
    setUploads(list)
    for (const u of list) {
      try {
        u.report = checkArt(await decodePng(u.img.png), PALETTE)
      } catch {
        u.report = { level: 'error', lines: [{ level: 'error', text: 'PNG okunamadı' }] }
      }
      // A broken image is not uploaded unless ticked by hand.
      if (u.report.level === 'error') u.state = 'skip'
    }
    setUploads([...list])
  }

  const upload = async () => {
    if (!uploads) return
    setRunning(true)
    let version = admin.data.version
    const list = [...uploads]
    for (const u of list) {
      if (u.state === 'skip' || (u.state === 'same' && !replaceLive)) {
        u.result = 'atlandı'
        continue
      }
      try {
        const r = await api.artPut(admin.conn, version, { id: u.img.id, png: u.img.png, setId: setId || undefined, type, tier: type === 'item' ? tier : undefined })
        version = r.version
        u.result = r.created ? 'taslak oluştu' : 'görsel yenilendi'
      } catch (e) {
        u.result = e instanceof Error ? e.message : String(e)
      }
      setUploads([...list])
    }
    setRunning(false)
    await admin.reload()
    const failed = list.filter((u) => u.result && !['atlandı', 'taslak oluştu', 'görsel yenilendi'].includes(u.result))
    if (failed.length === 0) setUploads(null)
    admin.setNotice(failed.length ? { kind: 'error', text: `${failed.length} görsel yüklenemedi, listede nedeni yazıyor.` } : { kind: 'ok', text: 'ZIP yüklendi. Taslaklar aşağıda sırayla onay bekliyor.' })
  }

  const sets = admin.data.doc.sets.slice().sort((a, b) => a.order - b.order)
  return (
    <div className="queue">
      <section className="card">
        <h2>ZIP yükle</h2>
        <p className="muted">
          Item Art Studio'nun ZIP'i: içinde sadece <code>&lt;eşya id&gt;.png</code> dosyaları. Yeni id'ler onay bekleyen taslak olur; ayarlarını onaylarken yaparsın.
        </p>
        <div className="row">
          <label className="button">
            ZIP seç…
            <input type="file" accept=".zip,application/zip" hidden onChange={(e) => e.target.files?.[0] && onZip(e.target.files[0])} />
          </label>
          <label>
            Yeni taslakların seti{' '}
            <select value={setId} onChange={(e) => setSetId(e.target.value)}>
              <option value="">— sonra seçerim —</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tür{' '}
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          {type === 'item' ? (
            <label>
              Tier{' '}
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {bad.length > 0 ? <p className="lvl-error">Adı eşya id'si olamayan dosyalar alınmadı: {bad.join(', ')} (küçük harf, rakam, _ ve . kullan)</p> : null}
        {uploads ? (
          <>
            <table className="list">
              <tbody>
                {uploads.map((u, i) => (
                  <tr key={u.img.id}>
                    <td>
                      <Thumb png={u.img.png} size={32} />
                    </td>
                    <td>
                      <b>{u.img.id}</b>
                      <div className="muted">{u.state === 'new' ? 'yeni taslak' : u.state === 'replace' ? 'taslağın görseli yenilenir' : u.state === 'same' ? 'oyunda olan eşya' : 'atlanacak'}</div>
                    </td>
                    <td className="grow">
                      <Report report={u.report} />
                    </td>
                    <td>
                      {u.result ?? (
                        <label className="check">
                          <input type="checkbox" checked={u.state !== 'skip'} onChange={(e) => setUploads(uploads.map((x, j) => (j === i ? { ...x, state: e.target.checked ? (admin.itemById(x.img.id) ? (admin.itemById(x.img.id)!.status === 'draft' ? 'replace' : 'same') : 'new') : 'skip' } : x)))} /> yükle
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {uploads.some((u) => u.state === 'same') ? (
              <label className="check">
                <input type="checkbox" checked={replaceLive} onChange={(e) => setReplaceLive(e.target.checked)} /> Oyundaki eşyaların görselini de değiştir (hemen oyuna yansır)
              </label>
            ) : null}
            <div className="actions">
              <button className="primary" disabled={running} onClick={upload}>
                {running ? 'Yükleniyor…' : `${uploads.filter((u) => u.state === 'new' || u.state === 'replace' || (u.state === 'same' && replaceLive)).length} görseli yükle`}
              </button>
              <button className="ghost" onClick={() => setUploads(null)}>
                Kapat
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="card">
        <h2>Onay bekleyenler ({drafts.length})</h2>
        {current ? (
          <>
            <div className="queue-strip">
              {waiting.map((d, i) => (
                <span key={d.id} className={i === 0 ? 'on' : ''} title={d.id}>
                  <Thumb png={admin.art[d.id]} tier={d.tier} size={32} />
                </span>
              ))}
            </div>
            <ItemEditor
              key={current.id}
              admin={admin}
              item={current}
              queue={{ index: 0, total: waiting.length, onSkip: () => setSkipped((s) => [...s.filter((x) => x !== current.id), current.id]) }}
              onDone={() => setSkipped((s) => s.filter((x) => x !== current.id))}
            />
          </>
        ) : (
          <p className="muted">Onay bekleyen eşya yok. ZIP yükle ya da JSON sekmesinden liste aktar.</p>
        )}
      </section>
    </div>
  )
}
