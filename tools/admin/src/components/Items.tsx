import { useEffect, useMemo, useState } from 'react'
import { generalChance, percent } from '../chance'
import { ITEM_TYPES, TIERS, newItem, type ContentItem } from '../content'
import type { Admin } from '../state'
import { ItemEditor } from './ItemEditor'
import { StatusTag, TIER_LABEL, TYPE_LABEL, Thumb } from './bits'

/** Every item: filter, open one to edit, or add a new one by hand (no image yet). */
export function Items({ admin, openId, onOpen }: { admin: Admin; openId: string | null; onOpen: (id: string | null) => void }) {
  const [q, setQ] = useState('')
  const [setId, setSetId] = useState('*')
  const [type, setType] = useState('*')
  const [tier, setTier] = useState('*')
  const [status, setStatus] = useState('*')
  const [creating, setCreating] = useState<ContentItem | null>(null)

  const sets = Object.fromEntries(admin.data.doc.sets.map((s) => [s.id, s]))
  const list = useMemo(
    () =>
      admin.data.doc.items
        .filter((it) => {
          if (q && !`${it.id} ${it.name}`.toLowerCase().includes(q.toLowerCase())) return false
          if (setId !== '*' && (it.setId ?? '') !== setId) return false
          if (type !== '*' && it.type !== type) return false
          if (tier !== '*' && (it.tier ?? '') !== tier) return false
          if (status === 'draft' && it.status !== 'draft') return false
          if (status === 'live' && !(it.status === 'live' && it.active)) return false
          if (status === 'off' && !(it.status === 'live' && !it.active)) return false
          if (status === 'craft' && !it.recipe) return false
          if (status === 'noart' && it.art) return false
          return true
        })
        .sort((a, b) => (sets[a.setId ?? '']?.order ?? 1e9) - (sets[b.setId ?? '']?.order ?? 1e9) || a.order - b.order || a.id.localeCompare(b.id)),
    [admin.data, q, setId, type, tier, status, sets],
  )
  useEffect(() => admin.loadArt(list.slice(0, 300).map((x) => x.id)), [admin, list])

  const open = openId ? admin.itemById(openId) : undefined
  if (creating) return <ItemEditor admin={admin} item={creating} onDone={() => setCreating(null)} />
  if (open)
    return (
      <div>
        <button className="ghost" onClick={() => onOpen(null)}>
          ← Listeye dön
        </button>
        <ItemEditor admin={admin} item={open} />
      </div>
    )

  const addNew = () => {
    const id = prompt('Yeni eşyanın id\'si (küçük harf, rakam, _ ve .), ör. sailor_knot')?.trim()
    if (!id) return
    if (admin.itemById(id)) return onOpen(id)
    setCreating(newItem(id, Date.now(), { setId: setId !== '*' && setId !== '' ? setId : null }))
  }

  return (
    <div className="items">
      <div className="filters">
        <input placeholder="Ara: id ya da isim" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={setId} onChange={(e) => setSetId(e.target.value)}>
          <option value="*">Bütün setler</option>
          <option value="">Set yok</option>
          {admin.data.doc.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="*">Bütün türler</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="*">Bütün Tier'lar</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="*">Hepsi</option>
          <option value="live">Oyunda</option>
          <option value="off">Pasif</option>
          <option value="draft">Onay bekliyor</option>
          <option value="craft">Craft edilebilir</option>
          <option value="noart">Görseli yok</option>
        </select>
        <span className="grow muted">{list.length} eşya</span>
        <button className="primary" onClick={addNew}>
          + Yeni eşya
        </button>
      </div>
      <table className="list clickable">
        <thead>
          <tr>
            <th></th>
            <th>Eşya</th>
            <th>Tür</th>
            <th>Set</th>
            <th>Defter</th>
            <th>Çıkış</th>
            <th>Oran</th>
            <th>Craft</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {list.map((it) => {
            const ch = generalChance(admin.rt, it.id)
            const r = admin.reports[it.id]
            return (
              <tr key={it.id} onClick={() => onOpen(it.id)}>
                <td>
                  <Thumb png={admin.art[it.id]} tier={it.tier} size={32} />
                </td>
                <td>
                  <b>{it.name}</b>
                  <div className="muted">{it.id}</div>
                </td>
                <td>
                  {TYPE_LABEL[it.type]}
                  {it.tier ? <div className={`tiertext tier-${it.tier}`}>{TIER_LABEL[it.tier]}</div> : null}
                </td>
                <td>{it.setId ? (sets[it.setId]?.name ?? it.setId) : <span className="muted">—</span>}</td>
                <td>{it.book ? '✓' : ''}</td>
                <td className="small">
                  {it.drop
                    ? [it.drop.waters?.join(', ') || 'her göl', it.drop.bands?.join(', ') || 'her derinlik', it.drop.minLevel ? `Lv ${it.drop.minLevel}+` : ''].filter(Boolean).join(' · ')
                    : <span className="muted">sudan çıkmaz</span>}
                </td>
                <td>{ch ? percent(ch.chance) : ''}</td>
                <td className="small">{it.recipe ? `${it.recipe.stacks.length + it.recipe.items.length} malzeme` : ''}</td>
                <td>
                  <StatusTag status={it.status} active={it.active} />
                  {r && r.level !== 'ok' ? <div className={`small lvl-${r.level}`}>görsel: {r.level === 'error' ? 'sorunlu' : 'uyarı'}</div> : null}
                  {!it.art ? <div className="small muted">görsel yok</div> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
