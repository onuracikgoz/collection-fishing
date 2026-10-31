import { useEffect, useState } from 'react'
import { api } from '../api'
import { ID_PATTERN, type ContentSet } from '../content'
import type { Admin } from '../state'
import { StatusTag, TIER_LABEL, TYPE_LABEL, Thumb } from './bits'

/** Sets: create, rename, switch off, order; each set's items in page order. */
export function Sets({ admin, onOpenItem }: { admin: Admin; onOpenItem: (id: string) => void }) {
  const sets = admin.data.doc.sets.slice().sort((a, b) => a.order - b.order)
  const [openId, setOpenId] = useState<string | null>(sets[0]?.id ?? null)
  const open = sets.find((s) => s.id === openId)

  const create = () => {
    const name = prompt('Setin adı (ör. Lost Captain)')?.trim()
    if (!name) return
    const suggested = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const id = prompt('Setin id\'si (küçük harf, rakam, _)', suggested)?.trim()
    if (!id) return
    if (!ID_PATTERN.test(id)) return admin.setNotice({ kind: 'error', text: 'id geçersiz: küçük harf, rakam, _ ve . kullan' })
    admin.run(`${name} seti oluştu`, (v) => api.setSave(admin.conn, v, { id, name, active: true })).then((ok) => ok && setOpenId(id))
  }

  const saveSet = (s: ContentSet, patch: Partial<ContentSet>, ok: string) => admin.run(ok, (v) => api.setSave(admin.conn, v, { ...s, ...patch }))

  // Writes order 0, 1, 2... after swapping two neighbours (only the ones that change).
  const move = (s: ContentSet, dir: -1 | 1) => {
    const i = sets.indexOf(s)
    if (!sets[i + dir]) return
    const next = sets.slice()
    next[i] = sets[i + dir]
    next[i + dir] = s
    admin.run('Sıra değişti', async (v) => {
      let version = v
      for (let j = 0; j < next.length; j++) if (next[j].order !== j) version = (await api.setSave(admin.conn, version, { ...next[j], order: j })).version
    })
  }

  return (
    <div className="sets">
      <section className="card side">
        <div className="row">
          <h2 className="grow">Setler</h2>
          <button className="primary" onClick={create}>
            + Yeni set
          </button>
        </div>
        <p className="muted">Aktif bir setin deftere giren eşyaları oyunda bir defter sayfası olur. Yeni sete ilk eşya onaylanınca sayfa kendiliğinden gelir.</p>
        <ul className="setlist">
          {sets.map((s, i) => {
            const items = admin.data.doc.items.filter((it) => it.setId === s.id)
            const page = admin.rt.pages.find((p) => p.id === s.id)
            return (
              <li key={s.id} className={s.id === openId ? 'on' : ''} onClick={() => setOpenId(s.id)}>
                <span className="grow">
                  <b>{s.name}</b> {s.active ? null : <span className="tag off">Pasif</span>}
                  <div className="muted small">
                    {s.id} · {items.length} eşya · {page ? `defterde ${page.items.length} kayıt` : 'defter sayfası yok'}
                  </div>
                </span>
                <button className="ghost" disabled={i === 0} onClick={(e) => (e.stopPropagation(), move(s, -1))}>
                  ↑
                </button>
                <button className="ghost" disabled={i === sets.length - 1} onClick={(e) => (e.stopPropagation(), move(s, 1))}>
                  ↓
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      {open ? <SetDetail key={open.id} admin={admin} set={open} onSave={saveSet} onOpenItem={onOpenItem} /> : null}
    </div>
  )
}

function SetDetail({ admin, set, onSave, onOpenItem }: { admin: Admin; set: ContentSet; onSave: (s: ContentSet, p: Partial<ContentSet>, ok: string) => Promise<boolean>; onOpenItem: (id: string) => void }) {
  const [name, setName] = useState(set.name)
  const items = admin.data.doc.items.filter((it) => it.setId === set.id).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  const others = admin.data.doc.items.filter((it) => it.setId !== set.id)
  useEffect(() => admin.loadArt(items.map((x) => x.id)), [admin, items])

  const saveItem = (id: string, patch: object, ok: string) => {
    const it = admin.itemById(id)
    if (it) admin.run(ok, (v) => api.itemSave(admin.conn, v, { ...it, ...patch }))
  }
  const reorder = (list: typeof items, ok: string) =>
    admin.run(ok, async (v) => {
      let version = v
      for (let i = 0; i < list.length; i++) if (list[i].order !== i) version = (await api.itemSave(admin.conn, version, { ...list[i], order: i })).version
    })
  const swap = (i: number, dir: -1 | 1) => {
    if (!items[i + dir]) return
    const next = items.slice()
    next[i] = items[i + dir]
    next[i + dir] = items[i]
    reorder(next, 'Sıra değişti')
  }
  const renumber = () => reorder(items, 'Sıra numaraları düzeltildi')

  return (
    <section className="card grow">
      <div className="row">
        <input className="title-input" value={name} onChange={(e) => setName(e.target.value)} />
        <button disabled={name.trim() === '' || name === set.name} onClick={() => onSave(set, { name: name.trim() }, 'Set adı değişti')}>
          Adı kaydet
        </button>
        <label className="check">
          <input type="checkbox" checked={set.active} onChange={(e) => onSave(set, { active: e.target.checked }, e.target.checked ? 'Set aktif' : 'Set pasif: eşyaları artık çıkmaz, sayfası defterden kalkar')} /> Aktif
        </label>
      </div>
      <div className="row">
        <span className="muted grow">{items.length} eşya, defter sırasıyla</span>
        <button className="ghost" onClick={renumber}>
          Sırayı 0, 1, 2… yap
        </button>
        <select
          value=""
          onChange={(e) => {
            const id = e.target.value
            const it = admin.itemById(id)
            if (it) saveItem(id, { setId: set.id, order: items.length }, `${it.name} bu sete eklendi`)
          }}
        >
          <option value="">+ Başka bir eşyayı bu sete taşı…</option>
          {others.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name} ({it.id})
            </option>
          ))}
        </select>
      </div>
      <table className="list">
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              <td className="small muted">{it.order}</td>
              <td>
                <Thumb png={admin.art[it.id]} tier={it.tier} size={32} />
              </td>
              <td className="grow clickable-cell" onClick={() => onOpenItem(it.id)}>
                <b>{it.name}</b> <span className="muted">{it.id}</span>
                <div className="small">
                  {TYPE_LABEL[it.type]}
                  {it.tier ? ` · ${TIER_LABEL[it.tier]}` : ''}
                  {it.book ? ' · defter' : ''}
                  {it.recipe ? ' · craft' : ''}
                </div>
              </td>
              <td>
                <StatusTag status={it.status} active={it.active} />
              </td>
              <td className="nowrap">
                <button className="ghost" disabled={i === 0} onClick={() => swap(i, -1)}>
                  ↑
                </button>
                <button className="ghost" disabled={i === items.length - 1} onClick={() => swap(i, 1)}>
                  ↓
                </button>
                {it.status === 'live' ? (
                  <button className="ghost" onClick={() => saveItem(it.id, { active: !it.active }, it.active ? `${it.name} pasife alındı` : `${it.name} aktif`)}>
                    {it.active ? 'Pasife al' : 'Aktif et'}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
