import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { itemUsedInTree, materialUsedInTree, tierRank, type Ref } from '../craftGraph'
import type { Admin } from '../state'
import { MATERIAL_KINDS, MATERIAL_SOURCES, partsUsing, type WardrobeMaterial } from '../../../../server/src/rules/wardrobe'
import { CraftTree } from './CraftTree'
import { ItemEditor } from './ItemEditor'
import { Field, TIER_LABEL, Thumb } from './bits'

export const KIND_LABEL: Record<string, string> = { base: 'Temel', ladder: 'Aile merdiveni', detail: 'Detay', special: 'Eşyaya özel', catalyst: 'Efekt katalizörü' }
export const SOURCE_LABEL: Record<string, string> = {
  fishing: 'Olta',
  fishing_night: 'Olta (gece)',
  fishing_morning: 'Olta (sabah)',
  fishing_evening: 'Olta (akşam)',
  fishing_winter: 'Olta (kış)',
  fishing_deep: 'Olta (derin)',
  mining: 'Maden',
  mining_cave: 'Maden (mağara)',
}
const TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const

interface Row {
  origin: 'collection' | 'wardrobe'
  id: string
  name: string
  tier: string | null
  /** Collection recipes that take it. */
  colUses: number
  /** Wardrobe recipes that take it (Mythic ones too). */
  wardUses: number
  info: string
  active: boolean
}

/**
 * Crafting malzemeleri: collection materials (content items of type material) and wardrobe craft
 * materials in one list, each tagged with the crafts it goes into. Opening one shows its "used in" tree.
 */
export function Materials({
  admin,
  openId,
  onOpen,
  onOpenItem,
  onOpenPart,
}: {
  admin: Admin
  openId: string | null
  onOpen: (id: string | null) => void
  onOpenItem: (id: string) => void
  onOpenPart: (id: string) => void
}) {
  const doc = admin.data.doc
  const cat = doc.wardrobe
  const [q, setQ] = useState('')
  const [origin, setOrigin] = useState('*')
  const [tier, setTier] = useState('*')
  const [use, setUse] = useState('*')

  const rows: Row[] = useMemo(() => {
    const colUses = (id: string) => doc.items.filter((it) => it.recipe && [...it.recipe.stacks, ...it.recipe.items].some((s) => s.defId === id)).length
    const col: Row[] = doc.items
      .filter((it) => it.type === 'material')
      .map((it) => ({
        origin: 'collection',
        id: it.id,
        name: it.name,
        tier: it.tier,
        colUses: colUses(it.id),
        wardUses: 0,
        info: it.status === 'draft' ? 'taslak' : it.active ? '' : 'pasif',
        active: it.active && it.status === 'live',
      }))
    const ward: Row[] = (cat?.materials ?? []).map((m) => ({
      origin: 'wardrobe',
      id: m.id,
      name: m.name,
      tier: m.tier,
      colUses: 0,
      wardUses: partsUsing(cat!, m.id).length,
      info: `${KIND_LABEL[m.kind]} · ${SOURCE_LABEL[m.source] ?? m.source}`,
      active: m.active,
    }))
    return [...col, ...ward]
  }, [doc, cat])

  const list = rows
    .filter((r) => origin === '*' || r.origin === origin)
    .filter((r) => tier === '*' || r.tier === tier)
    .filter((r) => use === '*' || (use === 'col' ? r.colUses > 0 : use === 'ward' ? r.wardUses > 0 : r.colUses + r.wardUses === 0))
    .filter((r) => !q || `${r.name} ${r.id}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))
  useEffect(() => admin.loadArt(list.filter((r) => r.origin === 'collection').map((r) => r.id)), [admin, list.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = openId ? rows.find((r) => r.id === openId) : undefined
  const addNew = () => {
    const name = prompt('Yeni gardırop malzemesinin İngilizce adı, ör. Silver Thread')?.trim()
    if (!name) return
    const id =
      'wmat_' +
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
    if (rows.some((r) => r.id === id)) return onOpen(id)
    void admin.run(`${name} eklendi`, (v) => api.wardrobeMaterialSave(admin.conn, v, { id, name, tier: 'common', kind: 'detail', source: 'fishing', active: true })).then((ok) => ok && onOpen(id))
  }

  return (
    <div className="materials">
      <div className="filters">
        <input placeholder="Ara: id ya da isim" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="*">Hepsi</option>
          <option value="collection">Collection malzemeleri</option>
          <option value="wardrobe">Gardırop malzemeleri</option>
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="*">Bütün Tier'lar</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
        <select value={use} onChange={(e) => setUse(e.target.value)}>
          <option value="*">Her kullanım</option>
          <option value="col">Collection craft'ında</option>
          <option value="ward">Gardırop craft'ında</option>
          <option value="none">Hiçbir tarifte yok</option>
        </select>
        <span className="grow muted">{list.length} malzeme</span>
        <button className="primary" onClick={addNew}>
          + Gardırop malzemesi
        </button>
      </div>
      <div className="mat-layout">
        <div className="mat-scroll">
          <table className="list clickable mat-list">
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.id === openId ? 'on' : ''} onClick={() => onOpen(r.id)}>
                  <td>{r.origin === 'collection' ? <Thumb png={admin.art[r.id]} tier={r.tier} size={24} /> : <span className={`dot tier-${r.tier}`} />}</td>
                  <td>
                    <b>{r.name}</b> {!r.active ? <span className="muted small">pasif</span> : null}
                    <div className="muted small">
                      {r.tier ? <span className={`tiertext tier-${r.tier}`}>{TIER_LABEL[r.tier]}</span> : null} {r.info}
                    </div>
                  </td>
                  <td className="nowrap small">
                    {r.colUses ? <span className="tag live">Collection craft: {r.colUses}</span> : null} {r.wardUses ? <span className="tag ward">Gardırop craft: {r.wardUses}</span> : null}
                    {r.colUses + r.wardUses === 0 ? <span className="muted">kullanılmıyor</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grow mat-detail">
          {!open ? <p className="muted">Bir malzeme seç: hangi eşyalara girdiğinin ağacı ve bütün özellikleri.</p> : null}
          {open?.origin === 'wardrobe' && cat ? (
            <WardrobeMaterialEditor key={open.id} admin={admin} mat={cat.materials!.find((m) => m.id === open.id)!} onOpenPart={onOpenPart} onDeleted={() => onOpen(null)} />
          ) : null}
          {open?.origin === 'collection' ? (
            <>
              <h3>Hangi eşyalara giriyor</h3>
              <CraftTree root={itemUsedInTree(doc, open.id)} up onOpen={(r: Ref) => r.kind === 'item' && r.id !== open.id && onOpenItem(r.id)} />
              <ItemEditor key={open.id} admin={admin} item={admin.itemById(open.id)!} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function WardrobeMaterialEditor({ admin, mat, onOpenPart, onDeleted }: { admin: Admin; mat: WardrobeMaterial; onOpenPart: (id: string) => void; onDeleted: () => void }) {
  const cat = admin.data.doc.wardrobe!
  const [d, setD] = useState<WardrobeMaterial>(() => ({ ...mat }))
  useEffect(() => setD({ ...mat }), [mat])
  const set = (patch: Partial<WardrobeMaterial>) => setD((x) => ({ ...x, ...patch }))
  const dirty = JSON.stringify(d) !== JSON.stringify(mat)
  const uses = partsUsing(cat, mat.id)
  const ladderOf = (cat.families ?? []).filter((f) => f.base === mat.id || Object.values(f.ladder).includes(mat.id))

  return (
    <section className="editor">
      <div className="editor-head">
        <h2 className="grow">
          {mat.name} <span className="muted small">{mat.id}</span>
        </h2>
        {dirty ? (
          <button className="ghost" onClick={() => setD({ ...mat })}>
            Geri al
          </button>
        ) : null}
        <button
          className="primary"
          disabled={!dirty || admin.busy}
          onClick={() => void admin.run(`${d.name} kaydedildi`, (v) => api.wardrobeMaterialSave(admin.conn, v, { ...d, note: d.note ?? '' }))}
        >
          Kaydet
        </button>
      </div>
      <div className="cos-fields">
        <Field label="İsim" hint="Oyunda İngilizce.">
          <input value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Tier" hint="Her malzeme tek Tier'dadır.">
          <select value={d.tier} onChange={(e) => set({ tier: e.target.value as WardrobeMaterial['tier'] })}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tür">
          <select value={d.kind} onChange={(e) => set({ kind: e.target.value as WardrobeMaterial['kind'] })}>
            {MATERIAL_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nereden" hint="Şimdilik sadece etiket (maden mekaniği yok).">
          <select value={d.source} onChange={(e) => set({ source: e.target.value })}>
            {MATERIAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Durum" hint="Pasif malzeme yeni tariflere eklenemez.">
          <label className="check">
            <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> Aktif
          </label>
        </Field>
        <Field label="Not" hint="Sadece panelde.">
          <input value={d.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </div>
      {ladderOf.length ? (
        <p className="small">
          Aile merdiveni:{' '}
          {ladderOf
            .map(
              (f) =>
                `${f.id} (${
                  f.base === mat.id
                    ? 'temel'
                    : Object.keys(f.ladder)
                        .filter((t) => f.ladder[t] === mat.id)
                        .map((t) => TIER_LABEL[t])
                        .join(', ')
                })`,
            )
            .join(', ')}
        </p>
      ) : null}
      <h3>Hangi eşyalara giriyor ({uses.length})</h3>
      {uses.length ? <CraftTree root={materialUsedInTree(cat, mat.id)} up onOpen={(r) => r.kind === 'part' && onOpenPart(r.id)} /> : <p className="muted">Hiçbir tarifte yok.</p>}
      {uses.length === 0 && ladderOf.length === 0 ? (
        <button
          className="ghost danger"
          onClick={() => confirm(`${mat.name} silinsin mi?`) && void admin.run(`${mat.name} silindi`, (v) => api.wardrobeMaterialDelete(admin.conn, v, mat.id)).then((ok) => ok && onDeleted())}
        >
          Malzemeyi sil
        </button>
      ) : null}
    </section>
  )
}
