import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { generalChance, percent } from '../chance'
import {
  BANDS,
  CATEGORIES,
  GRADES,
  ITEM_TYPES,
  TIERS,
  checkLiveChange,
  compileContent,
  validateContent,
  type Band,
  type ContentDoc,
  type ContentItem,
  type DropDef,
  type ItemType,
  type RecipeSpec,
  type Stack,
  recipeIdFor,
} from '../content'
import { bytesToBase64 } from '../images'
import type { Admin } from '../state'
import { Story } from './Story'
import { ArtView, BAND_LABEL, CATEGORY_LABEL, Field, StatusTag, TIER_LABEL, TYPE_LABEL, Thumb, Toggles } from './bits'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function withItem(doc: ContentDoc, input: ContentItem): ContentDoc {
  const d = clone(doc)
  // A new recipe gets its id when saved; check it with the id it will most likely get.
  const it = input.recipe && !input.recipe.id ? { ...input, recipe: { ...input.recipe, id: recipeIdFor(input.id) } } : input
  const i = d.items.findIndex((x) => x.id === it.id)
  if (i >= 0) d.items[i] = it
  else d.items.push(it)
  return d
}

function DropEditor({ admin, drop, onChange, what }: { admin: Admin; drop: DropDef | null; onChange: (d: DropDef | null) => void; what: string }) {
  const baits = admin.data.doc.items.filter((x) => x.type === 'bait').map((x) => x.id)
  if (!drop) {
    return (
      <div className="drop">
        <label className="check">
          <input type="checkbox" checked={false} onChange={() => onChange({})} /> {what} sudan çıkar
        </label>
      </div>
    )
  }
  const set = (patch: Partial<DropDef>) => {
    const next: DropDef = { ...drop, ...patch }
    for (const k of Object.keys(next) as (keyof DropDef)[]) {
      const v = next[k]
      if (v === undefined || (Array.isArray(v) && v.length === 0)) delete next[k]
    }
    onChange(next)
  }
  return (
    <div className="drop">
      <label className="check">
        <input type="checkbox" checked onChange={() => onChange(null)} /> {what} sudan çıkar
      </label>
      <Field label="Göller" hint="Hiçbiri seçili değilse her gölden çıkar.">
        <Toggles options={admin.data.waters} value={drop.waters ?? []} onChange={(waters) => set({ waters })} emptyText="her göl" />
      </Field>
      <Field label="Derinlik" hint="Hiçbiri seçili değilse her bantta çıkar.">
        <Toggles<Band> options={BANDS} value={drop.bands ?? []} onChange={(bands) => set({ bands })} labels={BAND_LABEL} emptyText="her derinlik" />
      </Field>
      <Field label="Yemle daha sık" hint="Bu yemle atınca kendi kategorisinde ×3 daha sık gelir.">
        <Toggles options={baits} value={drop.baits ?? []} onChange={(b) => set({ baits: b })} emptyText="yok" />
      </Field>
      <div className="row">
        <Field label="En düşük level">
          <input type="number" min={1} max={admin.data.maxLevel} value={drop.minLevel ?? 1} onChange={(e) => set({ minLevel: Math.max(1, Number(e.target.value) || 1) === 1 ? undefined : Number(e.target.value) })} />
        </Field>
        <Field label="Ağırlık" hint="Kategorisindeki diğer eşyalara göre. 1 = eşit, 2 = iki kat sık, 0.5 = yarısı.">
          <input type="number" min={0.01} step={0.1} value={drop.weight ?? 1} onChange={(e) => set({ weight: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  )
}

function ItemPicker({ admin, exclude, onPick }: { admin: Admin; exclude: string[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const sets = Object.fromEntries(admin.data.doc.sets.map((s) => [s.id, s.name]))
  const options = admin.data.doc.items.filter((x) => !exclude.includes(x.id))
  return (
    <span className="picker">
      <input
        list="all-items"
        placeholder="Malzeme ara (her setten)…"
        value={q}
        onChange={(e) => {
          const v = e.target.value
          if (options.some((o) => o.id === v)) {
            onPick(v)
            setQ('')
          } else setQ(v)
        }}
      />
      <datalist id="all-items">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} · {TYPE_LABEL[o.type]}
            {o.tier ? ` · ${TIER_LABEL[o.tier]}` : ''}
            {o.setId ? ` · ${sets[o.setId] ?? o.setId}` : ''}
            {o.status === 'draft' ? ' · taslak' : ''}
          </option>
        ))}
      </datalist>
    </span>
  )
}

function RecipeEditor({ admin, it, onChange }: { admin: Admin; it: ContentItem; onChange: (r: RecipeSpec | null) => void }) {
  const r = it.recipe
  if (!r) {
    return (
      <label className="check">
        <input type="checkbox" checked={false} onChange={() => onChange({ id: '', grade: 'normal', stacks: [], items: [], drop: null, starter: 0, ...(it.type !== 'item' ? { count: 1, dust: 0 } : {}) })} /> Craft edilebilir (recipe otomatik oluşur)
      </label>
    )
  }
  const inputs: (Stack & { kind: 'stacks' | 'items' })[] = [...r.stacks.map((s) => ({ ...s, kind: 'stacks' as const })), ...r.items.map((s) => ({ ...s, kind: 'items' as const }))]
  const write = (list: typeof inputs) =>
    onChange({ ...r, stacks: list.filter((x) => x.kind === 'stacks').map(({ defId, count }) => ({ defId, count })), items: list.filter((x) => x.kind === 'items').map(({ defId, count }) => ({ defId, count })) })
  const live = it.status === 'live' && admin.itemById(it.id)?.recipe
  return (
    <div className="recipe">
      <label className="check">
        <input type="checkbox" checked disabled={!!live} onChange={() => onChange(null)} /> Craft edilebilir
        <span className="muted"> · recipe: {r.id || '(kaydedince oluşur)'}</span>
        {live ? <span className="muted"> · oyuncular recipe'ye sahip olabilir, kapatmak yerine eşyayı pasife al</span> : null}
      </label>
      <div className="row">
        <Field label="Recipe derecesi" hint="İyi / Usta recipe daha iyi Float verir.">
          <select value={r.grade} onChange={(e) => onChange({ ...r, grade: e.target.value as RecipeSpec['grade'] })}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {{ normal: 'Normal', good: 'İyi', master: 'Usta' }[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Yeni hesaba ver" hint="Başlangıç recipe'si (adet).">
          <input type="number" min={0} max={99} value={r.starter} onChange={(e) => onChange({ ...r, starter: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
        {it.type !== 'item' ? (
          <>
            <Field label="Bir craft kaç adet yapar">
              <input type="number" min={1} max={99} value={r.count ?? 1} onChange={(e) => onChange({ ...r, count: Number(e.target.value) })} />
            </Field>
            <Field label="Toz">
              <input type="number" min={0} value={r.dust ?? 0} onChange={(e) => onChange({ ...r, dust: Number(e.target.value) })} />
            </Field>
          </>
        ) : null}
      </div>
      <div className="inputs">
        <span className="field-label">Malzemeler</span>
        {inputs.length === 0 ? <p className="muted">En az bir malzeme ekle.</p> : null}
        {inputs.map((x, i) => {
          const src = admin.itemById(x.defId)
          return (
            <div key={x.defId} className="input-row">
              <Thumb png={admin.art[x.defId]} tier={src?.tier} size={24} />
              <span className="grow">
                {src?.name ?? x.defId} <span className="muted">{x.defId}{x.kind === 'items' ? ' · Float eşya, oyuncu kopyayı seçer' : ''}</span>
              </span>
              <input type="number" min={1} max={99} value={x.count} onChange={(e) => write(inputs.map((y, j) => (j === i ? { ...y, count: Math.max(1, Number(e.target.value) || 1) } : y)))} />
              <button className="ghost" onClick={() => write(inputs.filter((_, j) => j !== i))}>
                Kaldır
              </button>
            </div>
          )
        })}
        <ItemPicker
          admin={admin}
          exclude={[it.id, ...inputs.map((x) => x.defId)]}
          onPick={(id) => {
            const src = admin.itemById(id)
            write([...inputs, { defId: id, count: 1, kind: src?.type === 'item' ? 'items' : 'stacks' }])
            admin.loadArt([id])
          }}
        />
      </div>
      <DropEditor admin={admin} drop={r.drop} onChange={(drop) => onChange({ ...r, drop })} what="Recipe" />
    </div>
  )
}

function BaitEditor({ it, onChange }: { it: ContentItem; onChange: (b: ContentItem['bait']) => void }) {
  const b = it.bait ?? { price: 5, boost: {} }
  return (
    <div className="bait">
      <div className="row">
        <Field label="Dükkan fiyatı (Coin)">
          <input type="number" min={1} value={b.price} onChange={(e) => onChange({ ...b, price: Number(e.target.value) })} />
        </Field>
        <Field label="Çalıştığı derinlik" hint="Boşsa her yerde.">
          <Toggles<Band> options={BANDS} value={b.bands ?? []} onChange={(bands) => onChange({ ...b, bands: bands.length ? bands : undefined })} labels={BAND_LABEL} emptyText="her derinlik" />
        </Field>
      </div>
      <Field label="Kategori çarpanları" hint="Ör. Rare 1.3 = Rare %30 daha sık. Boş = değişmez.">
        <span className="boosts">
          {CATEGORIES.map((c) => (
            <label key={c}>
              {CATEGORY_LABEL[c]}
              <input
                type="number"
                step={0.1}
                min={0}
                value={b.boost[c] ?? ''}
                onChange={(e) => {
                  const boost = { ...b.boost }
                  if (e.target.value === '') delete boost[c]
                  else boost[c] = Number(e.target.value)
                  onChange({ ...b, boost })
                }}
              />
            </label>
          ))}
        </span>
      </Field>
    </div>
  )
}

export function ItemEditor({ admin, item, onDone, queue }: { admin: Admin; item: ContentItem; onDone?: () => void; queue?: { index: number; total: number; onSkip: () => void } }) {
  const [it, setIt] = useState<ContentItem>(() => clone(item))
  useEffect(() => setIt(clone(item)), [item])
  useEffect(() => admin.loadArt([item.id]), [admin, item.id])

  const before = admin.itemById(it.id)
  const isNew = !before
  const set = (patch: Partial<ContentItem>) => setIt((x) => ({ ...x, ...patch }))

  const opt = { waters: admin.data.waters, maxLevel: admin.data.maxLevel }
  const errorsFor = (status: ContentItem['status']) => {
    const next = { ...it, status }
    const all = validateContent(withItem(admin.data.doc, next), opt)
    const mine = all.filter((e) => e.startsWith(`item ${it.id}`) || e.startsWith(`item "${it.id}"`))
    return before ? mine.concat(checkLiveChange(before, next)) : mine
  }
  const errors = errorsFor(it.status === 'draft' ? 'live' : it.status)
  const chance = useMemo(() => {
    const rt = compileContent(withItem(admin.data.doc, { ...it, status: 'live', active: true }))
    return { item: generalChance(rt, it.id), recipe: it.recipe ? generalChance(rt, it.recipe.id || recipeIdFor(it.id)) : null }
  }, [admin.data.doc, it])

  const changeType = (type: ItemType) => {
    const patch: Partial<ContentItem> = { type }
    if (type !== 'item') {
      patch.book = false
    } else if (!it.tier) patch.tier = 'common'
    if (type === 'bait') {
      patch.drop = null
      patch.bait = it.bait ?? { price: 5, boost: {} }
    }
    if (it.recipe) patch.recipe = type === 'item' ? { ...it.recipe, count: undefined, dust: undefined } : { ...it.recipe, count: it.recipe.count ?? 1, dust: it.recipe.dust ?? 0 }
    set(patch)
  }

  const save = (status: ContentItem['status'], ok: string) => {
    const report = admin.reports[it.id]
    if (status === 'live' && it.status === 'draft' && !it.art && !confirm('Bu eşyanın görseli yok. Yine de oyuna konsun mu?')) return
    if (status === 'live' && it.status === 'draft' && report?.level === 'error' && !confirm('Görsel kontrolünde hata var. Yine de oyuna konsun mu?')) return
    return admin.run(ok, (v) => api.itemSave(admin.conn, v, { ...it, status })).then((done) => {
      if (done && onDone) onDone()
    })
  }

  const replaceImage = async (file: File) => {
    const png = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
    await admin.run('Görsel değişti', (v) => api.artPut(admin.conn, v, { id: it.id, png }))
  }

  const sets = admin.data.doc.sets.slice().sort((a, b) => a.order - b.order)
  return (
    <div className="editor">
      <div className="editor-head">
        <Thumb png={admin.art[it.id]} tier={it.tier} size={48} />
        <div className="grow">
          <h2>{it.name || it.id}</h2>
          <span className="muted">{it.id}</span> {before ? <StatusTag status={before.status} active={before.active} /> : <span className="tag draft">Yeni</span>}
          {queue ? (
            <span className="muted">
              {' '}
              · kuyrukta {queue.index + 1} / {queue.total}
            </span>
          ) : null}
        </div>
      </div>

      <div className="editor-body">
        <section className="editor-art">
          <ArtView png={admin.art[it.id]} report={admin.reports[it.id]} />
          {!isNew ? (
            <label className="button ghost">
              Görseli değiştir…
              <input type="file" accept="image/png" hidden onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} />
            </label>
          ) : (
            <p className="muted">Görseli kaydettikten sonra ekleyebilirsin.</p>
          )}
        </section>

        <section className="editor-form">
          <div className="row">
            <Field label="İsim (İngilizce)">
              <input value={it.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Tür">
              <select value={it.type} onChange={(e) => changeType(e.target.value as ItemType)} disabled={before?.status === 'live'}>
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tier" hint={it.type === 'item' ? undefined : 'Yığılan eşyada sadece gösterim'}>
              <select value={it.tier ?? ''} onChange={(e) => set({ tier: (e.target.value || null) as ContentItem['tier'] })}>
                {it.type !== 'item' ? <option value="">—</option> : null}
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <Field label="Set">
              <select value={it.setId ?? ''} onChange={(e) => set({ setId: e.target.value || null })}>
                <option value="">— set yok —</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.active ? '' : ' (pasif)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Set içindeki sıra">
              <input type="number" value={it.order} onChange={(e) => set({ order: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="row checks">
            <label className="check">
              <input type="checkbox" checked={it.book} disabled={it.type !== 'item'} onChange={(e) => set({ book: e.target.checked })} /> Deftere giren eşya (Collection)
            </label>
            <label className="check">
              <input type="checkbox" checked={it.active} onChange={(e) => set({ active: e.target.checked })} /> Aktif
            </label>
          </div>
          {!it.active ? <p className="muted">Pasif: artık çıkmaz, defter sayfasında görünmez, craft edilemez. Oyuncudaki kopyalar satılabilir, kaybolmaz.</p> : null}

          {it.type === 'bait' ? (
            <BaitEditor it={it} onChange={(bait) => set({ bait })} />
          ) : (
            <>
              <h3>Nereden çıkar</h3>
              <DropEditor admin={admin} drop={it.drop} onChange={(drop) => set({ drop })} what="Eşya" />
              {chance.item ? (
                <p className="chance">
                  Genel düşme oranı: <b>{percent(chance.item.chance)}</b> atış başına{' '}
                  <span className="muted">
                    ({CATEGORY_LABEL[it.type === 'item' ? (it.tier ?? '') : it.type]} kategorisi {percent(chance.item.categoryShare)}, {chance.item.rivals} eşya arasında; derinlik, yem ve defter şansı hariç)
                  </span>
                </p>
              ) : null}
            </>
          )}

          <Story admin={admin} itemId={it.id} />

          <h3>Craft</h3>
          <RecipeEditor admin={admin} it={it} onChange={(recipe) => set({ recipe })} />
          {chance.recipe ? (
            <p className="chance">
              Recipe'nin genel düşme oranı: <b>{percent(chance.recipe.chance)}</b>
            </p>
          ) : null}
        </section>
      </div>

      {errors.length > 0 ? (
        <ul className="errors">
          {errors.map((e) => (
            <li key={e}>{e.replace(`item ${it.id}: `, '')}</li>
          ))}
        </ul>
      ) : null}

      <div className="actions">
        {it.status === 'draft' ? (
          <>
            <button className="primary" disabled={admin.busy || errors.length > 0} onClick={() => save('live', `${it.name} onaylandı, oyunda`)}>
              Onayla ve oyuna koy
            </button>
            <button disabled={admin.busy || errorsFor('draft').length > 0} onClick={() => save('draft', 'Taslak kaydedildi')}>
              Taslak olarak kaydet
            </button>
            {queue ? (
              <button className="ghost" onClick={queue.onSkip}>
                Sonra (atla)
              </button>
            ) : null}
            {!isNew ? (
              <button
                className="danger"
                disabled={admin.busy}
                onClick={() => confirm(`${it.id} taslağı silinsin mi?`) && admin.run('Taslak silindi', (v) => api.itemDelete(admin.conn, v, it.id)).then((d) => d && onDone?.())}
              >
                Sil
              </button>
            ) : null}
          </>
        ) : (
          <button className="primary" disabled={admin.busy || errors.length > 0} onClick={() => save('live', `${it.name} güncellendi`)}>
            Kaydet (oyunda hemen değişir)
          </button>
        )}
      </div>
    </div>
  )
}
