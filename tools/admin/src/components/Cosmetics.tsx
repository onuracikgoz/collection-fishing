import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { colorKindsLabel, effectName, ladderRecipe, materialUsedInTree, partTree, refKey, tierRank, type Ref } from '../craftGraph'
import { DIR_ROW, FRAME, drawLook, hasSprite, type Look } from '../lpc'
import type { Admin } from '../state'
import { validateWardrobe, type ColorKind, type WardrobeCatalog, type WardrobePart, type WardrobeRecipe } from '../../../../server/src/rules/wardrobe'
import { CraftTree } from './CraftTree'
import { Field, TIER_LABEL, Toggles } from './bits'

const WEAR_TIERS = ['common', 'rare', 'epic', 'legendary'] as const
const PART_KINDS: ColorKind[] = ['dye', 'hair', 'metal', 'gem']
const KIND_LABEL: Record<string, string> = { dye: 'Boya', hair: 'Saç boyası', metal: 'Külçe', gem: 'Mücevher' }
const PREVIEW_COLOR: Record<string, string> = { dye: 'dye_teal', hair: 'hair_chestnut', metal: 'metal_brass', gem: 'gem_blue' }

/** Body spots: which LPC slots they hold and where the arrow points (64x64 frame, facing down). */
const GROUPS: { id: string; label: string; slots: string[]; at: [number, number]; side: 'l' | 'r' }[] = [
  { id: 'hat', label: 'Şapka / miğfer', slots: ['hat', 'visor', 'headcover', 'bandana', 'accessory'], at: [32, 12], side: 'l' },
  { id: 'hair', label: 'Saç', slots: ['hair', 'hairextr', 'ponytail', 'hairtie', 'updo'], at: [25, 19], side: 'l' },
  { id: 'face', label: 'Gözlük / maske', slots: ['facial_eyes', 'facial_mask', 'facial_right'], at: [35, 25], side: 'r' },
  { id: 'ears', label: 'Küpe', slots: ['earrings', 'earring_right'], at: [39, 27], side: 'r' },
  { id: 'beard', label: 'Sakal / bıyık', slots: ['beard', 'mustache'], at: [32, 31], side: 'l' },
  { id: 'neck', label: 'Boyun / kolye', slots: ['neck', 'necklace', 'charm'], at: [32, 35], side: 'r' },
  { id: 'armour', label: 'Zırh / omuz', slots: ['armour', 'chainmail', 'shoulders', 'bauldron'], at: [25, 37], side: 'l' },
  { id: 'top', label: 'Üst / ceket / elbise', slots: ['clothes', 'vest', 'jacket', 'dress', 'overalls'], at: [34, 41], side: 'r' },
  { id: 'back', label: 'Sırt (pelerin, kanat, çanta)', slots: ['cape', 'wings', 'backpack', 'quiver'], at: [40, 38], side: 'r' },
  { id: 'arms', label: 'Kol / eldiven / yüzük', slots: ['wrists', 'bracers', 'gloves', 'arms', 'ring'], at: [21, 46], side: 'l' },
  { id: 'waist', label: 'Bel / önlük', slots: ['belt', 'sash', 'apron', 'buckles'], at: [32, 47], side: 'r' },
  { id: 'legs', label: 'Alt', slots: ['legs'], at: [29, 53], side: 'l' },
  { id: 'feet', label: 'Ayak', slots: ['shoes', 'socks', 'shoes_toe'], at: [34, 61], side: 'r' },
  { id: 'other', label: 'Diğer', slots: [], at: [44, 50], side: 'r' },
]
const groupOf = (slot: string) => GROUPS.find((g) => g.slots.includes(slot))?.id ?? 'other'

const EMPTY: WardrobeCatalog = { parts: [], colors: [] }

/** Kozmetik items: the LPC character, arrows to body spots, the parts of the chosen spots, one part's editor and recipe tree. */
export function Cosmetics({ admin, openId, onOpen, onOpenMaterial }: { admin: Admin; openId: string | null; onOpen: (id: string | null) => void; onOpenMaterial: (id: string) => void }) {
  const cat = admin.data.doc.wardrobe ?? EMPTY
  const [body, setBody] = useState<'male' | 'female'>('male')
  const [skin, setSkin] = useState('skin_peach')
  const [groups, setGroups] = useState<string[]>(['hat'])
  const [sort, setSort] = useState<'tier' | 'tier-desc' | 'name'>('tier')
  const [q, setQ] = useState('')
  const [tierFilter, setTierFilter] = useState('*')
  /** Parts tried on the preview, by slot, with the preview colour. */
  const [tried, setTried] = useState<Record<string, { part: string; color: string; color2?: string }>>({})

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of cat.parts) c[groupOf(p.slot)] = (c[groupOf(p.slot)] ?? 0) + 1
    return c
  }, [cat])

  const list = useMemo(() => {
    const ql = q.toLowerCase()
    return cat.parts
      .filter((p) => groups.includes(groupOf(p.slot)))
      .filter((p) => !ql || `${p.name} ${p.id}`.toLowerCase().includes(ql))
      .filter((p) => tierFilter === '*' || (tierFilter === 'free' ? p.free : p.tier === tierFilter))
      .sort((a, b) => (sort === 'name' ? 0 : (sort === 'tier' ? 1 : -1) * (tierRank(a.tier) - tierRank(b.tier))) || a.name.localeCompare(b.name))
  }, [cat, groups, q, sort, tierFilter])

  const open = openId ? cat.parts.find((p) => p.id === openId) : undefined
  const tryOn = (p: WardrobePart, color?: string) => {
    const c = color ?? previewColor(cat, p.colors)
    setTried((t) => ({ ...t, [p.slot]: { part: p.id, color: c, color2: p.color2 ? previewColor(cat, p.color2) : undefined } }))
  }
  const pick = (p: WardrobePart) => {
    onOpen(p.id)
    tryOn(p)
  }

  const look: Look = useMemo(() => {
    const base: Record<string, { part: string; color: string; color2?: string }> = {
      clothes: { part: 'torso_clothes_tshirt', color: 'dye_white' },
      legs: { part: 'legs_pants', color: 'dye_navy' in colorIds(cat) ? 'dye_navy' : 'dye_gray' },
      shoes: { part: 'feet_shoes_basic', color: 'dye_black' },
      hair: { part: 'hair_plain', color: 'hair_dark_brown' },
    }
    const all = { ...base, ...tried }
    const parts = Object.values(all).filter((x) => {
      const p = cat.parts.find((y) => y.id === x.part)
      return p && p.bodies.includes(body)
    })
    return { body, skin, eyes: 'eye_blue', parts }
  }, [body, skin, tried, cat])

  const toggleGroup = (id: string, multi: boolean) => setGroups((g) => (multi ? (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]) : g.length === 1 && g[0] === id ? g : [id]))

  return (
    <div className="cosmetics">
      <div className="cos-top">
        <section className="card cos-stage-card">
          <div className="row">
            <Toggles<'male' | 'female'> options={['male', 'female']} value={[body]} onChange={(v) => v.length && setBody(v[v.length - 1])} labels={{ male: 'Gövde: erkek', female: 'Gövde: kadın' }} />
            <select value={skin} onChange={(e) => setSkin(e.target.value)}>
              {cat.colors
                .filter((c) => c.kind === 'skin')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id.replace('skin_', 'Ten: ')}
                  </option>
                ))}
            </select>
            {Object.keys(tried).length ? (
              <button className="ghost" onClick={() => setTried({})}>
                Denenenleri çıkar
              </button>
            ) : null}
          </div>
          <Stage look={look} groups={groups} counts={counts} onToggle={toggleGroup} />
          <p className="muted small">Bir noktaya bas: o yuvanın eşyaları. Ctrl / ⌘ ya da Shift ile birden fazla seç. Eşyaya basınca karakterin üstünde denenir.</p>
        </section>
        <section className="card grow cos-list">
          <div className="row">
            <h2 className="grow">
              {groups.map((g) => GROUPS.find((x) => x.id === g)?.label).join(' + ') || 'Yuva seç'} <span className="muted">({list.length})</span>
            </h2>
            <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
              <option value="*">Bütün Tier'lar</option>
              <option value="free">Bedava</option>
              {WEAR_TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="tier">Tier: düşükten yükseğe</option>
              <option value="tier-desc">Tier: yüksekten düşüğe</option>
              <option value="name">İsim</option>
            </select>
            <input placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="cos-grid">
            {list.map((p) => (
              <button key={p.id} className={`cos-part ${p.free ? '' : 'tier-' + p.tier} ${p.id === openId ? 'on' : ''} ${p.active ? '' : 'off'}`} onClick={() => pick(p)}>
                <PartThumb cat={cat} part={p} body={body} skin={skin} />
                <span className="cos-part-name">{p.name}</span>
                <span className="small">
                  {p.free ? <span className="muted">Bedava</span> : <span className={`tiertext tier-${p.tier}`}>{TIER_LABEL[p.tier!]}</span>}
                  {p.effects.length ? <span className="tiertext tier-mythic"> · {p.effects.length} Mythic</span> : null}
                  {!p.active ? <span className="muted"> · pasif</span> : null}
                  {!p.bodies.includes(body) ? <span className="muted"> · bu gövdede yok</span> : null}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
      {open ? (
        <PartEditor
          key={open.id}
          admin={admin}
          cat={cat}
          part={open}
          onOpenPart={(id) => {
            onOpen(id)
            const p = cat.parts.find((x) => x.id === id)
            if (p) {
              tryOn(p)
              if (!groups.includes(groupOf(p.slot))) setGroups((g) => [...g, groupOf(p.slot)])
            }
          }}
          onOpenMaterial={onOpenMaterial}
          onPreviewColor={(c) => tryOn(open, c)}
        />
      ) : null}
    </div>
  )
}

const colorIds = (cat: WardrobeCatalog) => Object.fromEntries(cat.colors.map((c) => [c.id, c]))

function previewColor(cat: WardrobeCatalog, kinds: string[]): string {
  if (!kinds.length) return ''
  const ids = colorIds(cat)
  const want = PREVIEW_COLOR[kinds[0]]
  if (want && ids[want]) return want
  return cat.colors.find((c) => c.kind === kinds[0])?.id ?? ''
}

const SCALE = 5
const STAGE_W = 600
const STAGE_H = 400
const CHAR_X = (STAGE_W - FRAME * SCALE) / 2
const CHAR_Y = (STAGE_H - FRAME * SCALE) / 2
const BTN_W = 132

function Stage({ look, groups, counts, onToggle }: { look: Look; groups: string[]; counts: Record<string, number>; onToggle: (id: string, multi: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    setMissing(!hasSprite('body'))
    void drawLook(ref.current, look, DIR_ROW.down)
  }, [look])

  // Buttons on each side, spread top to bottom in the order of their body spot.
  const placed = (['l', 'r'] as const).flatMap((side) => {
    const g = GROUPS.filter((x) => x.side === side && (counts[x.id] ?? 0) > 0).sort((a, b) => a.at[1] - b.at[1])
    const step = STAGE_H / (g.length + 1)
    return g.map((x, i) => ({ ...x, y: step * (i + 1), x: side === 'l' ? 0 : STAGE_W - BTN_W }))
  })

  return (
    <div className="cos-stage" style={{ width: STAGE_W, height: STAGE_H }}>
      <canvas ref={ref} width={FRAME} height={FRAME} style={{ left: CHAR_X, top: CHAR_Y, width: FRAME * SCALE, height: FRAME * SCALE }} />
      {missing ? (
        <p className="muted small" style={{ position: 'absolute', left: CHAR_X, top: CHAR_Y }}>
          LPC sayfaları bulunamadı
        </p>
      ) : null}
      <svg width={STAGE_W} height={STAGE_H}>
        {placed.map((g) => {
          const on = groups.includes(g.id)
          const ax = CHAR_X + g.at[0] * SCALE
          const ay = CHAR_Y + g.at[1] * SCALE
          const bx = g.side === 'l' ? BTN_W : STAGE_W - BTN_W
          return (
            <g key={g.id} className={on ? 'on' : ''}>
              <line x1={bx} y1={g.y} x2={ax} y2={ay} />
              <circle cx={ax} cy={ay} r={on ? 4 : 3} />
            </g>
          )
        })}
      </svg>
      {placed.map((g) => (
        <button
          key={g.id}
          className={`cos-spot ${groups.includes(g.id) ? 'on' : ''}`}
          style={{ left: g.x, top: g.y - 15, width: BTN_W }}
          onClick={(e) => onToggle(g.id, e.ctrlKey || e.metaKey || e.shiftKey)}
        >
          {g.label} <span className="muted">{counts[g.id]}</span>
        </button>
      ))}
    </div>
  )
}

/** The part alone on the chosen body, cropped to where it is drawn. */
function PartThumb({ cat, part, body, skin }: { cat: WardrobeCatalog; part: WardrobePart; body: 'male' | 'female'; skin: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const b = part.bodies.includes(body) ? body : (part.bodies[0] ?? body)
    void drawLook(
      ref.current,
      { body: b, skin, eyes: 'eye_blue', parts: [{ part: part.id, color: previewColor(cat, part.colors), color2: part.color2 ? previewColor(cat, part.color2) : undefined }] },
      DIR_ROW.down,
    )
  }, [cat, part, body, skin])
  return <canvas ref={ref} width={FRAME} height={FRAME} className="cos-thumb" />
}

type Draft = WardrobePart

function PartEditor({
  admin,
  cat,
  part,
  onOpenPart,
  onOpenMaterial,
  onPreviewColor,
}: {
  admin: Admin
  cat: WardrobeCatalog
  part: WardrobePart
  onOpenPart: (id: string) => void
  onOpenMaterial: (id: string) => void
  onPreviewColor: (c: string) => void
}) {
  const [d, setD] = useState<Draft>(() => structuredClone(part))
  useEffect(() => setD(structuredClone(part)), [part])
  const [focus, setFocus] = useState<string | null>(null)
  const [fx, setFx] = useState<string>('')
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const dirty = JSON.stringify(d) !== JSON.stringify(part)

  const draftCat: WardrobeCatalog = useMemo(() => ({ ...cat, parts: cat.parts.map((p) => (p.id === d.id ? d : p)) }), [cat, d])
  const errors = useMemo(() => validateWardrobe(draftCat).filter((e) => e.includes(` ${d.id}`)), [draftCat, d.id])
  const families = cat.families ?? []
  const fxColors = cat.colors.filter((c) => c.kind === 'fx')
  const mats = cat.materials ?? []

  const setRecipe = (which: string, r: WardrobeRecipe | undefined) => {
    if (!which) return set({ recipe: r })
    const m = { ...(d.mythic ?? {}) }
    if (r) m[which] = r
    else delete m[which]
    set({ mythic: m })
  }
  const recipeOf = (which: string) => (which ? d.mythic?.[which] : d.recipe)
  const editFor = (which: string) => {
    const r = recipeOf(which)
    if (!r) return undefined
    return {
      onCount: (i: number, count: number) => setRecipe(which, { mats: r.mats.map((s, j) => (j === i ? { ...s, count } : s)) }),
      onRemove: (i: number) => setRecipe(which, { mats: r.mats.filter((_, j) => j !== i) }),
      adder: <MatPicker mats={mats} exclude={r.mats.map((s) => s.mat)} onPick={(mat) => setRecipe(which, { mats: [...r.mats, { mat, count: 1 }] })} />,
    }
  }

  const openRef = (r: Ref) => {
    if (r.kind === 'wmat') setFocus(r.id)
    else if (r.kind === 'part' && r.id !== d.id) onOpenPart(r.id)
    else if (r.kind === 'part') setFx(r.fx ?? '')
  }

  const save = () => {
    const body: Record<string, unknown> = {
      id: d.id,
      name: d.name,
      family: d.family,
      tier: d.tier,
      free: d.free,
      active: d.active,
      colors: d.colors,
      color2: d.color2 ?? null,
      effects: d.effects,
      recipe: d.recipe ?? null,
      mythic: d.mythic ?? null,
    }
    void admin.run(`${d.name} kaydedildi`, (v) => api.wardrobePartSave(admin.conn, v, body))
  }

  const previewKinds = d.colors.length ? d.colors : []
  const previewOptions = cat.colors.filter((c) => previewKinds.includes(c.kind) || d.effects.includes(c.id))
  const tree = partTree(draftCat, d.id, fx || undefined)
  const ladder = ladderRecipe(draftCat, d)

  return (
    <section className="editor cos-editor">
      <div className="editor-head">
        <h2 className="grow">
          {part.name}{' '}
          <span className="muted small">
            {part.id} · yuva {part.slot} · {part.bodies.join(', ') || 'gövde yok'}
          </span>
        </h2>
        {dirty ? (
          <button className="ghost" onClick={() => setD(structuredClone(part))}>
            Geri al
          </button>
        ) : null}
        <button className="primary" disabled={!dirty || errors.length > 0 || admin.busy} onClick={save}>
          Kaydet
        </button>
      </div>
      {errors.length ? (
        <div className="errors">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      ) : null}
      <div className="cos-fields">
        <Field label="İsim" hint="Oyunda İngilizce.">
          <input value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Aile" hint="Craft ailesi ve gardırop sekmesi.">
          <select value={d.family} onChange={(e) => set({ family: e.target.value })}>
            {families.length === 0 ? <option value={d.family}>{d.family}</option> : null}
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} · {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tier">
          <select
            value={d.free ? '' : (d.tier ?? '')}
            onChange={(e) => (e.target.value === '' ? set({ free: true, tier: null, recipe: undefined }) : set({ free: false, tier: e.target.value as Draft['tier'] }))}
          >
            <option value="">Bedava (başlangıç)</option>
            {WEAR_TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Durum" hint={d.bodies.length === 0 ? 'Yetişkin gövde çizimi yok, aktif olamaz.' : 'Pasif parça artık verilmez, sahipleri giymeye devam eder.'}>
          <label className="check">
            <input type="checkbox" checked={d.active} disabled={d.bodies.length === 0} onChange={(e) => set({ active: e.target.checked })} /> Aktif
          </label>
        </Field>
        <Field label="Renk türü" hint="Boşsa sabit renk.">
          <Toggles<ColorKind> options={PART_KINDS} value={d.colors} onChange={(colors) => set({ colors })} labels={KIND_LABEL} emptyText="sabit" />
        </Field>
        <Field label="İkinci renk alanı">
          <span className="row">
            <label className="check">
              <input type="checkbox" checked={!!d.color2} onChange={(e) => set({ color2: e.target.checked ? ['dye'] : undefined })} /> Var
            </label>
            {d.color2 ? <Toggles<ColorKind> options={PART_KINDS} value={d.color2} onChange={(color2) => set({ color2 })} labels={KIND_LABEL} emptyText="sabit" /> : null}
          </span>
        </Field>
        <Field label="Mythic efektleri" hint="Bu renklerle yapılan kopya Mythic olur, tarifi ayrıdır.">
          <Toggles<string>
            options={fxColors.map((c) => c.id)}
            value={d.effects}
            onChange={(effects) => setD((x) => ({ ...x, effects, mythic: Object.fromEntries(Object.entries(x.mythic ?? {}).filter(([k]) => effects.includes(k))) }))}
            labels={Object.fromEntries(fxColors.map((c) => [c.id, effectName(c.id)]))}
            emptyText="yok"
          />
        </Field>
        <Field label="Önizleme rengi" hint="Sadece bu ekranda.">
          <select onChange={(e) => onPreviewColor(e.target.value)} defaultValue="">
            <option value="" disabled>
              Renk seç…
            </option>
            {previewOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} {c.tier ? `· ${TIER_LABEL[c.tier]}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <h3>Craft ağacı</h3>
      <div className="row">
        <Toggles<string>
          options={['', ...d.effects]}
          value={[fx]}
          onChange={(v) => setFx(v.length ? v[v.length - 1] : '')}
          labels={{ '': `Normal (${d.free ? 'bedava' : TIER_LABEL[d.tier ?? 'common']})`, ...Object.fromEntries(d.effects.map((e) => [e, `${effectName(e)} (Mythic)`])) }}
        />
      </div>
      {d.free && !fx ? (
        <p className="muted">Bedava parça craft edilmez.</p>
      ) : recipeOf(fx) ? (
        <>
          <CraftTree root={tree} onOpen={openRef} selected={focus ? refKey({ kind: 'wmat', id: focus }) : undefined} edit={editFor(fx)} />
          <div className="row">
            {!fx && ladder ? (
              <button className="ghost" onClick={() => setRecipe('', ladder)} title="Temel ×3-6 + ailenin bu Tier'daki ve bir alttaki imza malzemesi">
                Aile kuralıyla baştan yaz
              </button>
            ) : null}
            <button className="ghost" onClick={() => setRecipe(fx, undefined)}>
              Tarifi sil
            </button>
            <span className="muted small">Kalıp (×1) ve renkler her tarifte vardır. Malzemeye basınca nerelerde kullanıldığı açılır.</span>
          </div>
        </>
      ) : (
        <div className="row">
          <span className="muted">Tarifi yok.</span>
          {!fx && ladder ? (
            <button className="primary" onClick={() => setRecipe('', ladder)}>
              Aile kuralıyla oluştur
            </button>
          ) : null}
          <button className="ghost" onClick={() => setRecipe(fx, { mats: [] })}>
            Boş tarif
          </button>
        </div>
      )}
      <p className="muted small">
        Renk: {colorKindsLabel(d.colors)}
        {d.color2 ? ` + ikinci renk ${colorKindsLabel(d.color2)}` : ''}. Değişiklikler Kaydet'e basınca sunucuya gider.
      </p>

      {focus ? (
        <div className="cos-usedin">
          <div className="row">
            <h3 className="grow">{mats.find((m) => m.id === focus)?.name ?? focus}: hangi eşyalara giriyor</h3>
            <button className="ghost" onClick={() => onOpenMaterial(focus)}>
              Malzemeyi düzenle →
            </button>
            <button className="ghost" onClick={() => setFocus(null)}>
              Kapat
            </button>
          </div>
          <CraftTree root={materialUsedInTree(draftCat, focus)} onOpen={openRef} up selected={refKey({ kind: 'part', id: d.id, fx: fx || undefined })} />
        </div>
      ) : null}
    </section>
  )
}

export function MatPicker({ mats, exclude, onPick }: { mats: WardrobeCatalog['materials']; exclude: string[]; onPick: (id: string) => void }) {
  const [v, setV] = useState('')
  const options = (mats ?? []).filter((m) => m.active && !exclude.includes(m.id)).sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))
  const label = (m: NonNullable<WardrobeCatalog['materials']>[number]) => `${m.name} · ${TIER_LABEL[m.tier]} · ${m.id}`
  const listId = useMemo(() => 'mats-' + Math.random().toString(36).slice(2), [])
  return (
    <span className="picker">
      <input
        placeholder="+ malzeme ekle (ara)"
        list={listId}
        value={v}
        onChange={(e) => {
          const m = options.find((o) => label(o) === e.target.value || o.id === e.target.value)
          if (m) {
            onPick(m.id)
            setV('')
          } else setV(e.target.value)
        }}
      />
      <datalist id={listId}>
        {options.map((m) => (
          <option key={m.id} value={label(m)} />
        ))}
      </datalist>
    </span>
  )
}
