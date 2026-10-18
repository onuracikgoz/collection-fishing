import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import './App.css'
import paletteFileText from '../../../content/palette.hex?raw'
import { PixelCanvas } from './components/PixelCanvas'
import { PrepareInspector } from './components/PrepareInspector'
import { VariantInspector } from './components/VariantInspector'
import { extractColorPalette, getColorGroupKey } from './engine/colorMapping'
import type { PrepareSettings } from './engine/pipeline'
import { hexToRgb, rgbToHex } from './engine/pixels'
import { createPaletteMatcher, paletteToHex, parseHexPalette } from './engine/quantize'
import { highlightGroup } from './engine/recolor'
import {
  createVariant,
  generateRandomVariants,
  resetVariant,
  uniqueId,
  type VariantSpec,
  type VariantStatus,
} from './engine/variant'
import { useRenderCache } from './hooks/renderCache'
import { itemFileName, parseCollectionSet } from './models/collectionSet'
import {
  createBase,
  setItemFor,
  syncSetVariants,
  toSnakeId,
  type BaseEntry,
  type GamePalette,
  type ProjectState,
} from './models/project'
import { parseStudioFile, toStudioFile } from './models/studioFile'
import { blobFile, downloadSingle, downloadZip, jsonFile, type ExportFile } from './services/exporter'
import { bufferToPngBlob, loadPngFile } from './services/imageIO'
import { loadProject, saveProject } from './services/projectStorage'

const DEFAULT_PALETTE: GamePalette = { name: 'Resurrect 64 (content/palette.hex)', colors: parseHexPalette(paletteFileText) }
const EMPTY_PROJECT: ProjectState = { bases: [], set: null, palette: DEFAULT_PALETTE }
const GAME_SIZES = [32, 48, 96]
type Step = 'prepare' | 'variants'
type Filter = 'all' | VariantStatus

function App() {
  const [project, setProject] = useState<ProjectState>(EMPTY_PROJECT)
  const [loaded, setLoaded] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('prepare')
  const [filter, setFilter] = useState<Filter>('all')
  const [randomCount, setRandomCount] = useState(6)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [erasing, setErasing] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const cache = useRenderCache()

  const { bases, set, palette } = project
  const base = bases.find((b) => b.key === activeKey) ?? bases[0] ?? null
  const variant = base?.variants.find((v) => v.id === activeVariantId) ?? base?.variants[0] ?? null
  const paletteHex = useMemo(() => paletteToHex(palette.colors), [palette])
  const matcher = useMemo(() => createPaletteMatcher(palette.colors), [palette])
  const usePalette = !!base?.prepare.quantize && palette.colors.length > 0

  // --- Otomatik kayıt -------------------------------------------------------

  useEffect(() => {
    loadProject()
      .then((saved) => {
        if (saved && Array.isArray(saved.bases)) {
          setProject({ ...EMPTY_PROJECT, ...saved, palette: saved.palette?.colors?.length ? saved.palette : DEFAULT_PALETTE })
          setActiveKey(saved.bases[0]?.key ?? null)
          if (saved.bases.length) setStep('variants')
        }
      })
      .catch(() => setMessage({ kind: 'info', text: 'Önceki çalışma yüklenemedi; yeni başlıyoruz.' }))
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!loaded) return
    const timer = window.setTimeout(() => {
      saveProject(project).catch(() => setMessage({ kind: 'error', text: 'Otomatik kayıt başarısız (tarayıcı depolaması dolu olabilir).' }))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [project, loaded])

  // --- Durum yardımcıları ---------------------------------------------------

  const updateBase = useCallback((key: string, change: (b: BaseEntry) => BaseEntry) => {
    setProject((p) => ({ ...p, bases: p.bases.map((b) => (b.key === key ? change(b) : b)) }))
  }, [])

  const updateVariant = useCallback((id: string, change: Partial<VariantSpec>) => {
    if (!base) return
    updateBase(base.key, (b) => ({ ...b, variants: b.variants.map((v) => (v.id === id ? { ...v, ...change } : v)) }))
    if (change.id && change.id !== id) setActiveVariantId(change.id)
  }, [base, updateBase])

  function snapHex(hex: string | null): string | null {
    if (!hex || !usePalette) return hex
    const rgb = hexToRgb(hex)
    return rgb ? rgbToHex(...matcher.nearest(rgb)) : hex
  }

  function changeVariant(change: Partial<VariantSpec>) {
    if (!variant) return
    const snapped: Partial<VariantSpec> = { ...change }
    if (change.tint !== undefined) snapped.tint = snapHex(change.tint)
    if (change.patternColor !== undefined) snapped.patternColor = snapHex(change.patternColor)
    if (change.outlineColor !== undefined) snapped.outlineColor = snapHex(change.outlineColor)
    if (change.id !== undefined && base && base.variants.some((v) => v.id === change.id && v !== variant)) {
      setMessage({ kind: 'error', text: `${change.id} zaten var.` })
      return
    }
    updateVariant(variant.id, snapped)
  }

  function changePrepare(change: Partial<PrepareSettings>) {
    if (!base) return
    updateBase(base.key, (b) => ({ ...b, prepare: { ...b.prepare, ...change } }))
  }

  // --- Dosya alma (toplu) ---------------------------------------------------

  async function importFiles(files: File[]) {
    setMessage(null)
    const pngs = files.filter((f) => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png'))
    const jsons = files.filter((f) => f.name.toLowerCase().endsWith('.json'))
    const hexes = files.filter((f) => f.name.toLowerCase().endsWith('.hex'))
    const errors: string[] = []

    let nextSet = project.set
    let nextPalette = project.palette
    for (const file of hexes) {
      const colors = parseHexPalette(await file.text())
      if (colors.length) nextPalette = { name: file.name, colors }
      else errors.push(`${file.name}: renk bulunamadı.`)
    }

    const studios = []
    for (const file of jsons) {
      const text = await file.text()
      try {
        if (text.includes('"item-art-studio/')) studios.push(parseStudioFile(text))
        else nextSet = parseCollectionSet(text)
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const newBases: BaseEntry[] = []
    const taken = new Set(project.bases.map((b) => b.baseId))
    for (const file of pngs) {
      try {
        const buffer = await loadPngFile(file)
        const entry = createBase(file.name, buffer)
        entry.baseId = uniqueId(entry.baseId, taken)
        taken.add(entry.baseId)
        newBases.push(entry)
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    let allBases = [...project.bases, ...newBases]
    for (const studio of studios) {
      const target = allBases.find((b) => b.baseId === studio.base_id || b.fileName === studio.source_image)
      if (!target) {
        errors.push(`${studio.base_id}.studio.json: önce ${studio.source_image || studio.base_id + '.png'} görselini ekle.`)
        continue
      }
      allBases = allBases.map((b) => b === target
        ? { ...b, baseId: studio.base_id, prepare: studio.prepare, tolerance: studio.tolerance, variants: studio.variants }
        : b)
    }
    // Set renklerini palete oturt ki seçili renk paletteki karşılığıyla eşleşsin.
    const setMatcher = createPaletteMatcher(nextPalette.colors)
    const snapSet = (hex: string | null) => {
      const rgb = hex ? hexToRgb(hex) : null
      return rgb && nextPalette.colors.length ? rgbToHex(...setMatcher.nearest(rgb)) : hex
    }
    allBases = allBases.map((b) => {
      const synced = syncSetVariants(b, nextSet)
      if (synced === b) return b
      const before = new Set(b.variants.map((v) => v.id))
      return {
        ...synced,
        variants: synced.variants.map((v) => (before.has(v.id) || v.origin !== 'set' ? v : { ...v, tint: snapSet(v.tint) })),
      }
    })

    setProject({ bases: allBases, set: nextSet, palette: nextPalette })
    if (newBases.length) {
      setActiveKey(newBases[0].key)
      setActiveVariantId(null)
      setStep('prepare')
    }

    const unmatched = nextSet ? newBases.filter((b) => !nextSet!.items.some((i) => i.base_id === b.baseId)) : []
    if (errors.length) setMessage({ kind: 'error', text: errors.join(' · ') })
    else if (unmatched.length) {
      setMessage({ kind: 'info', text: `Sette karşılığı olmayan görseller: ${unmatched.map((b) => b.fileName).join(', ')}. Dosya adı base_id ile aynı olmalı.` })
    } else if (newBases.length || nextSet !== project.set) {
      setMessage({ kind: 'info', text: `${newBases.length} görsel eklendi${nextSet ? `, set: ${nextSet.name}` : ''}.` })
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    void importFiles(Array.from(event.dataTransfer.files))
  }

  function removeBase(key: string) {
    setProject((p) => ({ ...p, bases: p.bases.filter((b) => b.key !== key) }))
    if (activeKey === key) setActiveKey(null)
  }

  function renameBase(value: string) {
    if (!base) return
    const baseId = toSnakeId(value)
    updateBase(base.key, (b) => syncSetVariants({ ...b, baseId }, set))
  }

  function clearProject() {
    if (!window.confirm('Bütün görseller ve varyantlar silinsin mi? (Set ve palet kalır.)')) return
    setProject((p) => ({ ...p, bases: [] }))
    setActiveKey(null)
  }

  // --- Varyantlar -----------------------------------------------------------

  function generateRandom() {
    if (!base) return
    const created = generateRandomVariants(randomCount, base.baseId, palette.colors, base.variants)
    updateBase(base.key, (b) => ({ ...b, variants: [...b.variants, ...created] }))
    setActiveVariantId(created[0]?.id ?? null)
    setFilter('all')
  }

  function addBlank() {
    if (!base) return
    const id = uniqueId(`${base.baseId}_variant`, new Set(base.variants.map((v) => v.id)))
    updateBase(base.key, (b) => ({ ...b, variants: [...b.variants, createVariant(id, id, 'manual')] }))
    setActiveVariantId(id)
  }

  function duplicateVariant() {
    if (!base || !variant) return
    const id = uniqueId(`${variant.id}_copy`, new Set(base.variants.map((v) => v.id)))
    const copy: VariantSpec = { ...variant, id, name: `${variant.name} copy`, origin: 'manual', status: 'pending' }
    updateBase(base.key, (b) => ({ ...b, variants: [...b.variants, copy] }))
    setActiveVariantId(id)
  }

  function deleteVariant(id: string) {
    if (!base) return
    updateBase(base.key, (b) => ({ ...b, variants: b.variants.filter((v) => v.id !== id) }))
    setActiveVariantId(null)
  }

  function deleteRejected() {
    if (!base) return
    updateBase(base.key, (b) => ({ ...b, variants: b.variants.filter((v) => v.status !== 'rejected' || v.origin === 'set') }))
  }

  function changeTolerance(tolerance: number) {
    if (!base) return
    // Grup anahtarları toleransa bağlı; eski ince ayarlar artık geçersiz.
    updateBase(base.key, (b) => ({
      ...b,
      tolerance,
      variants: b.variants.map((v) => ({ ...v, replacements: {}, tintGroups: [] })),
    }))
    setSelectedGroup(null)
  }

  const visibleVariants = useMemo(
    () => (base ? base.variants.filter((v) => filter === 'all' || v.status === filter) : []),
    [base, filter],
  )

  // Klavye: A onayla, X reddet, ←/→ gez, E silgi.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return
      if (step === 'prepare' && event.key.toLowerCase() === 'e') {
        setErasing((e) => !e)
        return
      }
      if (step !== 'variants' || !variant) return
      const list = visibleVariants
      const index = list.findIndex((v) => v.id === variant.id)
      const key = event.key.toLowerCase()
      if (key === 'a' || key === 'x') {
        const status: VariantStatus = key === 'a' ? 'approved' : 'rejected'
        updateVariant(variant.id, { status: variant.status === status ? 'pending' : status })
        const next = list[index + 1]
        if (next && variant.status !== status) setActiveVariantId(next.id)
      } else if (event.key === 'ArrowRight' && list[index + 1]) {
        setActiveVariantId(list[index + 1].id)
      } else if (event.key === 'ArrowLeft' && index > 0) {
        setActiveVariantId(list[index - 1].id)
      } else {
        return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, variant, visibleVariants, updateVariant])

  // --- Türetilen görseller --------------------------------------------------

  const prepared = base ? cache.getPrepared(base, palette.colors) : null
  const rendered = base && variant ? cache.getRendered(base, variant, palette.colors) : null
  const groups = useMemo(
    () => (prepared && base ? extractColorPalette(prepared.buffer.data, base.tolerance) : []),
    [prepared, base],
  )
  const preview = rendered && prepared && base && selectedGroup && step === 'variants'
    ? highlightGroup(rendered, prepared.buffer, selectedGroup, base.tolerance)
    : rendered

  function handlePreparedClick(x: number, y: number) {
    if (!base || !prepared) return
    if (step === 'prepare') {
      if (!erasing) return
      const point = prepared.toSource(x, y)
      if (point) changePrepare({ erasePoints: [...base.prepare.erasePoints, point] })
      return
    }
    const data = prepared.buffer.data
    const i = (y * prepared.buffer.width + x) * 4
    if (data[i + 3] === 0) {
      setSelectedGroup(null)
      return
    }
    const key = getColorGroupKey(data[i], data[i + 1], data[i + 2], base.tolerance)
    setSelectedGroup(selectedGroup === key ? null : key)
  }

  function handleSourceClick(x: number, y: number) {
    if (!base || !erasing) return
    changePrepare({ erasePoints: [...base.prepare.erasePoints, { x, y }] })
  }

  // --- Dışa aktarma ---------------------------------------------------------

  function fileNameFor(spec: VariantSpec): string {
    const item = setItemFor(set, spec.id)
    return item ? itemFileName(item) : `${spec.id}.png`
  }

  const approvedCount = bases.reduce((n, b) => n + b.variants.filter((v) => v.status === 'approved').length, 0)

  async function exportZip() {
    try {
      const files: ExportFile[] = []
      const manifest: Array<Record<string, unknown> & { id: string }> = []
      for (const b of bases) {
        const approved = b.variants.filter((v) => v.status === 'approved')
        for (const spec of approved) {
          const name = fileNameFor(spec)
          files.push(await blobFile(`png/${name}`, await bufferToPngBlob(cache.getRendered(b, spec, palette.colors))))
          manifest.push({
            id: spec.id,
            name: spec.name,
            base_id: b.baseId,
            image: name,
            in_set: !!setItemFor(set, spec.id),
            tint: spec.tint,
            material: spec.material,
            pattern: spec.pattern,
          })
        }
        if (b.variants.length) files.push(jsonFile(`studio/${b.baseId}.studio.json`, toStudioFile(b, set?.set_id ?? null, palette.name)))
      }
      files.push(jsonFile('variants.json', { set_id: set?.set_id ?? null, palette: palette.name, items: manifest }))
      downloadZip(files, `${set?.set_id ?? 'items'}-art.zip`)
      const missing = set ? set.items.filter((i) => !manifest.some((m) => m.id === i.id)).length : 0
      setMessage({ kind: 'info', text: `${manifest.length} PNG dışa aktarıldı.${missing ? ` Sette henüz onaylanmamış ${missing} eşya var.` : ''}` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function exportOne() {
    if (!variant || !rendered) return
    downloadSingle(await blobFile(fileNameFor(variant), await bufferToPngBlob(rendered)), 'image/png')
  }

  // --- Arayüz ---------------------------------------------------------------

  const setCount = set ? set.items.length : 0
  const setItem = variant ? setItemFor(set, variant.id) : null

  return (
    <div
      className={`app ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
      onDrop={onDrop}
    >
      <header className="topbar">
        <div className="brand">
          <h1>Item Art Studio</h1>
          <span>AI ikonu → oyun paleti → varyantlar</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>Add files</button>
          <input ref={fileInput} type="file" multiple hidden accept="image/png,.json,.hex"
            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void importFiles(files) }} />
          <button type="button" className="btn btn-primary" disabled={approvedCount === 0} onClick={() => void exportZip()}>
            Export ZIP ({approvedCount})
          </button>
        </div>
      </header>

      {message && (
        <div className={`banner banner-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          <span>{message.text}</span>
          <button type="button" className="link" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {bases.length === 0 ? (
        <section className="empty">
          <div className="empty-card">
            <h2>Başlamak için dosyaları buraya bırak</h2>
            <ol>
              <li><b>PNG'ler</b>: Perchance çıktıları, istediğin kadar. Dosya adı = <code>base_id</code> (ör. <code>crystal_shard.png</code>).</li>
              <li><b>set.json</b> (isteğe bağlı): setin eşyaları varyant olarak hazır gelir.</li>
              <li><b>.studio.json</b> (isteğe bağlı): önceki çalışmanı geri yükler.</li>
            </ol>
            <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>Choose files</button>
            <p className="hint">Palet: {palette.name}, {palette.colors.length} renk. Çalışman bu tarayıcıda otomatik saklanır.</p>
          </div>
        </section>
      ) : (
        <main className="layout">
          <aside className="library">
            <div className="library-head">
              <h2>Images</h2>
              <button type="button" className="link" onClick={clearProject}>clear</button>
            </div>
            {set && <p className="hint">Set: <b>{set.name}</b> · {setCount} items</p>}
            <ul>
              {bases.map((b) => {
                const approved = b.variants.filter((v) => v.status === 'approved').length
                const matched = !set || set.items.some((i) => i.base_id === b.baseId)
                return (
                  <li key={b.key} className={b.key === base?.key ? 'active' : ''}>
                    <button type="button" className="library-item" onClick={() => { setActiveKey(b.key); setActiveVariantId(null); setSelectedGroup(null) }}>
                      <PixelCanvas buffer={cache.getPrepared(b, palette.colors).buffer} displaySize={40} className="pixel thumb" />
                      <span className="library-text">
                        <b>{b.baseId}</b>
                        <small>
                          {approved}/{b.variants.length} approved{!matched && ' · not in set'}
                        </small>
                      </span>
                    </button>
                    <button type="button" className="link" title="Remove" onClick={() => removeBase(b.key)}>✕</button>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="btn btn-wide" onClick={() => fileInput.current?.click()}>+ Add PNGs</button>
          </aside>

          {base && prepared && (
            <section className="stage">
              <div className="stage-head">
                <input className="base-name" value={base.baseId} onChange={(e) => renameBase(e.target.value)} title="base_id" />
                <nav className="steps">
                  <button type="button" className={step === 'prepare' ? 'on' : ''} onClick={() => setStep('prepare')}>1 · Prepare</button>
                  <button type="button" className={step === 'variants' ? 'on' : ''} onClick={() => { setStep('variants'); setErasing(false) }}>
                    2 · Variants ({base.variants.length})
                  </button>
                </nav>
              </div>

              {step === 'prepare' ? (
                <div className="compare">
                  <figure>
                    <div className={`canvas-box ${erasing ? 'erasing' : ''}`}>
                      <PixelCanvas buffer={base.source} className="fit" onPixelClick={handleSourceClick} />
                    </div>
                    <figcaption>Original · {base.source.width}×{base.source.height}</figcaption>
                  </figure>
                  <figure>
                    <div className={`canvas-box ${erasing ? 'erasing' : ''}`}>
                      <PixelCanvas buffer={prepared.buffer} className="fit" onPixelClick={handlePreparedClick} />
                    </div>
                    <figcaption>
                      Game icon · {prepared.buffer.width}×{prepared.buffer.height} · {extractColorPalette(prepared.buffer.data, 1).length} colors
                    </figcaption>
                  </figure>
                  <div className="next">
                    <button type="button" className="btn btn-primary" onClick={() => { setStep('variants'); setErasing(false) }}>
                      Next: variants →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="variants">
                  <div className="hero">
                    <div className="canvas-box">
                      {preview && <PixelCanvas buffer={preview} className="fit" onPixelClick={handlePreparedClick} />}
                    </div>
                    {rendered && (
                      <div className="sizes">
                        {GAME_SIZES.map((size) => (
                          <figure key={size}>
                            <PixelCanvas buffer={rendered} displaySize={size} className="pixel" />
                            <figcaption>{size}px</figcaption>
                          </figure>
                        ))}
                        <p className="hint">Oyunda görüneceği boyutlar. A onayla · X reddet · ←/→ gez</p>
                      </div>
                    )}
                  </div>

                  <div className="toolbar">
                    <div className="filters">
                      {(['all', 'pending', 'approved', 'rejected'] as Filter[]).map((f) => (
                        <button type="button" key={f} className={`chip ${filter === f ? 'chip-on' : ''}`} onClick={() => setFilter(f)}>
                          {f} ({f === 'all' ? base.variants.length : base.variants.filter((v) => v.status === f).length})
                        </button>
                      ))}
                    </div>
                    <div className="row">
                      <select value={randomCount} onChange={(e) => setRandomCount(Number(e.target.value))} aria-label="How many">
                        {[3, 6, 9, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button type="button" className="btn btn-primary" onClick={generateRandom}>🎲 Random</button>
                      <button type="button" className="btn" onClick={addBlank}>+ Blank</button>
                      <button type="button" className="btn" disabled={!base.variants.some((v) => v.status === 'rejected' && v.origin !== 'set')} onClick={deleteRejected}>
                        Delete rejected
                      </button>
                    </div>
                  </div>

                  <div className="grid">
                    {visibleVariants.map((spec) => (
                      <button
                        type="button"
                        key={spec.id}
                        className={`card status-${spec.status} ${spec.id === variant?.id ? 'active' : ''}`}
                        onClick={() => setActiveVariantId(spec.id)}
                      >
                        <PixelCanvas buffer={cache.getRendered(base, spec, palette.colors)} displaySize={72} className="pixel" />
                        <span className="card-name">{spec.name}</span>
                        <span className="card-meta">
                          {spec.origin === 'set' ? 'set' : spec.origin}
                          {spec.material !== 'none' && ` · ${spec.material}`}
                        </span>
                        {spec.status !== 'pending' && <span className="card-badge">{spec.status === 'approved' ? '✓' : '✕'}</span>}
                      </button>
                    ))}
                    {visibleVariants.length === 0 && <p className="hint">Bu filtrede varyant yok.</p>}
                  </div>
                </div>
              )}
            </section>
          )}

          <aside className="side">
            {base && step === 'prepare' && (
              <PrepareInspector
                prepare={base.prepare}
                paletteName={palette.name}
                paletteSize={palette.colors.length}
                erasing={erasing}
                onChange={changePrepare}
                onToggleEraser={() => setErasing((e) => !e)}
                onPaletteFile={(file) => void importFiles([file])}
                baseCount={bases.length}
                onApplyToAll={() => setProject((p) => ({
                  ...p,
                  bases: p.bases.map((b) => ({ ...b, prepare: { ...base.prepare, erasePoints: b.key === base.key ? base.prepare.erasePoints : b.prepare.erasePoints } })),
                }))}
              />
            )}
            {base && step === 'variants' && variant && (
              <VariantInspector
                spec={variant}
                idLocked={variant.origin === 'set'}
                targetColor={snapHex(setItem?.variant_color ?? null)}
                paletteHex={usePalette ? paletteHex : paletteHex.slice(0, 0)}
                usePalette={usePalette}
                groups={groups}
                selectedGroup={selectedGroup}
                tolerance={base.tolerance}
                onChange={changeVariant}
                onSelectGroup={setSelectedGroup}
                onTolerance={changeTolerance}
                onReset={() => updateVariant(variant.id, { ...resetVariant(variant), tint: variant.origin === 'set' ? snapHex(setItem?.variant_color ?? null) : null })}
                onDuplicate={duplicateVariant}
                onDelete={() => deleteVariant(variant.id)}
                onExportOne={() => void exportOne()}
              />
            )}
          </aside>
        </main>
      )}

      {dragging && <div className="drop-overlay">Drop PNG / set.json / .studio.json / .hex</div>}
    </div>
  )
}

export default App
