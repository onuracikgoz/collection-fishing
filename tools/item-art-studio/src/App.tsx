import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import './App.css'
import paletteFileText from '../../../content/palette.hex?raw'
import { PixelCanvas } from './components/PixelCanvas'
import { PrepareInspector } from './components/PrepareInspector'
import { countColors } from './engine/color'
import { prepareForGame, type PrepareSettings } from './engine/pipeline'
import { parseHexPalette } from './engine/quantize'
import { usePreparedCache } from './hooks/preparedCache'
import { itemFileName, parseCollectionSet, type CollectionSet } from './models/collectionSet'
import {
  approveImage,
  createImage,
  groupByItem,
  toSnakeId,
  type GamePalette,
  type ImageEntry,
  type ImageStatus,
  type ProjectState,
} from './models/project'
import { isStudioText, parseStudioFile, type StudioFile } from './models/studioFile'
import { blobFile, downloadSingle, downloadZip, type ExportFile } from './services/exporter'
import { bufferToPngBlob, loadImageBlob, loadPngFile } from './services/imageIO'
import { loadProject, saveProject } from './services/projectStorage'

const DEFAULT_PALETTE: GamePalette = { name: 'Resurrect 64 (content/palette.hex)', colors: parseHexPalette(paletteFileText) }
const EMPTY_PROJECT: ProjectState = { images: [], set: null, palette: DEFAULT_PALETTE }
const GAME_SIZES = [32, 48, 96]

function App() {
  const [project, setProject] = useState<ProjectState>(EMPTY_PROJECT)
  const [loaded, setLoaded] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [erasing, setErasing] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const getPrepared = usePreparedCache()

  const { images, set, palette } = project
  const groups = useMemo(() => groupByItem(images, set), [images, set])
  // Klavyeyle gezinme sırası: listede görünen sıra.
  const ordered = useMemo(() => groups.flatMap((g) => g.images), [groups])
  const active = images.find((i) => i.key === activeKey) ?? ordered[0] ?? null
  const activeGroup = active ? groups.find((g) => g.itemId === active.itemId) ?? null : null
  const setItem = active ? set?.items.find((i) => i.id === active.itemId) ?? null : null

  // --- Otomatik kayıt -------------------------------------------------------

  useEffect(() => {
    loadProject()
      .then((saved) => {
        if (saved && Array.isArray(saved.images)) {
          setProject({ ...EMPTY_PROJECT, ...saved, palette: saved.palette?.colors?.length ? saved.palette : DEFAULT_PALETTE })
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

  function updateImage(key: string, change: Partial<ImageEntry>) {
    setProject((p) => ({ ...p, images: p.images.map((i) => (i.key === key ? { ...i, ...change } : i)) }))
  }

  function changePrepare(change: Partial<PrepareSettings>) {
    if (!active) return
    updateImage(active.key, { prepare: { ...active.prepare, ...change } })
  }

  function setStatus(image: ImageEntry, status: ImageStatus) {
    if (status === 'approved') setProject((p) => ({ ...p, images: approveImage(p.images, image.key) }))
    else updateImage(image.key, { status })
  }

  function step(delta: number) {
    if (!active) return
    const index = ordered.findIndex((i) => i.key === active.key)
    const next = ordered[index + delta]
    if (next) setActiveKey(next.key)
  }

  // --- Dosya alma (toplu) ---------------------------------------------------

  async function importFiles(files: File[]) {
    setMessage(null)
    const errors: string[] = []
    let nextSet: CollectionSet | null = project.set
    let nextPalette = project.palette
    const studios: StudioFile[] = []
    const added: ImageEntry[] = []

    for (const file of files) {
      const name = file.name.toLowerCase()
      try {
        if (name.endsWith('.png') || file.type === 'image/png') {
          added.push(createImage(file.name, await loadPngFile(file)))
        } else if (name.endsWith('.hex')) {
          const colors = parseHexPalette(await file.text())
          if (!colors.length) throw new Error('renk bulunamadı.')
          nextPalette = { name: file.name, colors }
        } else if (name.endsWith('.json')) {
          const text = await file.text()
          if (isStudioText(text)) studios.push(parseStudioFile(text))
          else nextSet = parseCollectionSet(text)
        } else {
          throw new Error('desteklenmeyen dosya (PNG, set.json, .studio.json veya .hex bekleniyor).')
        }
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    let allImages = [...project.images, ...added]
    for (const studio of studios) {
      const target = allImages.find((i) => i.fileName === studio.source_image) ?? allImages.find((i) => i.itemId === studio.item_id)
      if (!target) {
        errors.push(`${studio.item_id}.studio.json: önce ${studio.source_image || 'kaynak PNG'} görselini ekle.`)
        continue
      }
      allImages = allImages.map((i) => (i === target ? { ...i, itemId: studio.item_id, prepare: studio.prepare } : i))
    }

    setProject({ images: allImages, set: nextSet, palette: nextPalette })
    if (added.length) {
      setActiveKey(added[0].key)
      setErasing(false)
    }

    const unmatched = nextSet ? added.filter((i) => !nextSet!.items.some((item) => item.id === i.itemId)) : []
    if (errors.length) setMessage({ kind: 'error', text: errors.join(' · ') })
    else if (unmatched.length) {
      setMessage({
        kind: 'info',
        text: `Sette karşılığı olmayan görseller: ${unmatched.map((i) => i.fileName).join(', ')}. Dosya adı eşya id'si olmalı; ortadaki alandan düzeltebilirsin.`,
      })
    } else if (added.length || nextSet !== project.set) {
      setMessage({ kind: 'info', text: `${added.length} görsel eklendi${nextSet ? `, set: ${nextSet.name}` : ''}.` })
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    void importFiles(Array.from(event.dataTransfer.files))
  }

  // Ctrl+V / Cmd+V: panodaki görseli ekler. Panodaki dosyaların adı tarayıcıya göre hep
  // "image.png" olur; eşya id'si karışmasın diye pasted_1, pasted_2... adı verilir.
  useEffect(() => {
    async function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const items = Array.from(event.clipboardData?.items ?? [])
      const blobs = items.filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter((f): f is File => !!f)
      const others = items.filter((i) => i.kind === 'file' && !i.type.startsWith('image/')).map((i) => i.getAsFile()).filter((f): f is File => !!f)
      if (!blobs.length && !others.length) {
        if (items.length) setMessage({ kind: 'error', text: 'Panoda görsel yok. Görselin kendisini kopyala (sağ tık → Görseli kopyala).' })
        return
      }
      event.preventDefault()
      if (others.length) await importFiles(others)
      if (!blobs.length) return
      const used = new Set(project.images.map((i) => i.fileName))
      let n = 1
      const added: ImageEntry[] = []
      try {
        for (const blob of blobs) {
          while (used.has(`pasted_${n}.png`)) n++
          const name = `pasted_${n}.png`
          used.add(name)
          added.push(createImage(name, await loadImageBlob(blob)))
        }
      } catch (err) {
        setMessage({ kind: 'error', text: `Yapıştırılan görsel okunamadı: ${err instanceof Error ? err.message : String(err)}` })
        return
      }
      setProject((p) => ({ ...p, images: [...p.images, ...added] }))
      setActiveKey(added[0].key)
      setErasing(false)
      setMessage({ kind: 'info', text: `Panodan ${added.length} görsel eklendi (${added.map((i) => i.itemId).join(', ')}). Eşya id'sini ortadaki alandan düzelt.` })
    }
    const listener = (e: ClipboardEvent) => void onPaste(e)
    window.addEventListener('paste', listener)
    return () => window.removeEventListener('paste', listener)
  })

  function removeImage(key: string) {
    setProject((p) => ({ ...p, images: p.images.filter((i) => i.key !== key) }))
    if (activeKey === key) setActiveKey(null)
  }

  function clearProject() {
    if (!window.confirm('Bütün görseller silinsin mi? (Set ve palet kalır.)')) return
    setProject((p) => ({ ...p, images: [] }))
    setActiveKey(null)
  }

  // Klavye: A onayla, X reddet, ←/→ gez, E silgi.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return
      if (!active) return
      const key = event.key.toLowerCase()
      if (key === 'e') setErasing((e) => !e)
      else if (key === 'a') {
        setStatus(active, active.status === 'approved' ? 'pending' : 'approved')
        if (active.status !== 'approved') step(1)
      } else if (key === 'x') {
        setStatus(active, active.status === 'rejected' ? 'pending' : 'rejected')
        if (active.status !== 'rejected') step(1)
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') step(1)
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') step(-1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // --- Önizleme -------------------------------------------------------------

  const prepared = active ? getPrepared(active, palette.colors) : null

  function handlePreparedClick(x: number, y: number) {
    if (!active || !prepared || !erasing) return
    const point = prepared.toSource(x, y)
    if (point) changePrepare({ erasePoints: [...active.prepare.erasePoints, point] })
  }

  function handleSourceClick(x: number, y: number) {
    if (!active || !erasing) return
    changePrepare({ erasePoints: [...active.prepare.erasePoints, { x, y }] })
  }

  // --- Dışa aktarma ---------------------------------------------------------

  const approvedGroups = groups.filter((g) => g.approved)
  const setGroups = groups.filter((g) => g.inSet)
  const missing = setGroups.filter((g) => !g.approved)

  // ZIP'te sadece görseller var: `<item id>.png` (128, defter) ve `<item id>@32.png` (çanta
  // yuvası ve yer ikonu). Admin paneli dosya adından eşyayı bulur, ikisini birlikte yükler;
  // eşyanın ayarları (isim, Tier, set, göl...) orada yapılır.
  async function exportZip() {
    try {
      const files: ExportFile[] = []
      for (const group of approvedGroups) {
        const image = group.approved!
        const { item, icon } = prepareForGame(image.source, image.prepare, palette.colors)
        files.push(await blobFile(`${group.itemId}.png`, await bufferToPngBlob(item)))
        files.push(await blobFile(`${group.itemId}@32.png`, await bufferToPngBlob(icon)))
      }
      downloadZip(files, `${set?.set_id ?? 'items'}-art.zip`)
      setMessage({
        kind: 'info',
        text: `${files.length / 2} eşya dışa aktarıldı (128 ve 32 px).${missing.length ? ` Sette görseli onaylanmamış ${missing.length} eşya var.` : ''}`,
      })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function exportOne() {
    if (!active || !prepared) return
    downloadSingle(await blobFile(itemFileName(setItem, active.itemId), await bufferToPngBlob(prepared.buffer)), 'image/png')
  }

  // --- Arayüz ---------------------------------------------------------------

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
          <span>AI görseli → oyun ikonu</span>
        </div>
        <div className="topbar-actions">
          {set && (
            <span className="progress" title="Onaylı görseli olan set eşyaları">
              {set.name}: <b>{setGroups.length - missing.length}/{setGroups.length}</b> ready
            </span>
          )}
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>Add files</button>
          <input ref={fileInput} type="file" multiple hidden accept="image/png,.json,.hex"
            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void importFiles(files) }} />
          <button type="button" className="btn btn-primary" disabled={approvedGroups.length === 0} onClick={() => void exportZip()}>
            Export ZIP ({approvedGroups.length})
          </button>
        </div>
      </header>

      {message && (
        <div className={`banner banner-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          <span>{message.text}</span>
          <button type="button" className="link" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {images.length === 0 && !set ? (
        <section className="empty">
          <div className="empty-card">
            <h2>Başlamak için dosyaları buraya bırak</h2>
            <ol>
              <li><b>PNG'ler</b>: Perchance çıktıları, istediğin kadar. Dosya adı = eşya id'si (ör. <code>glass_bottle_blue.png</code>). Aynı eşya için birden fazla aday olabilir. Kopyaladığın görseli <b>Ctrl+V / Cmd+V</b> ile de yapıştırabilirsin.</li>
              <li><b>set.json</b> (isteğe bağlı): hangi eşyanın görseli eksik, listede görünür.</li>
              <li><b>.studio.json</b> (isteğe bağlı): önceki ayarları geri yükler.</li>
            </ol>
            <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>Choose files</button>
            <p className="hint">Palet: {palette.name}, {palette.colors.length} renk. Çalışman bu tarayıcıda otomatik saklanır.</p>
          </div>
        </section>
      ) : (
        <main className="layout">
          <aside className="library">
            <div className="library-head">
              <h2>Items</h2>
              <button type="button" className="link" onClick={clearProject}>clear</button>
            </div>
            <ul>
              {groups.map((group) => (
                <li key={group.itemId} className={`item-group ${group.itemId === active?.itemId ? 'active' : ''}`}>
                  <div className="item-head">
                    <span className={`dot ${group.approved ? 'dot-ok' : group.images.length ? 'dot-wait' : 'dot-missing'}`} />
                    <span className="item-title">
                      <b>{group.name}</b>
                      <small>{group.itemId}{group.tier && ` · ${group.tier}`}{!group.inSet && set && ' · not in set'}</small>
                    </span>
                  </div>
                  {group.images.length === 0 ? (
                    <p className="missing">Görsel yok</p>
                  ) : (
                    <div className="candidates">
                      {group.images.map((image) => (
                        <button
                          type="button"
                          key={image.key}
                          title={image.fileName}
                          className={`candidate status-${image.status} ${image.key === active?.key ? 'selected' : ''}`}
                          onClick={() => { setActiveKey(image.key); setErasing(false) }}
                        >
                          <PixelCanvas buffer={getPrepared(image, palette.colors).buffer} displaySize={40} className="pixel" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-wide" onClick={() => fileInput.current?.click()}>+ Add PNGs</button>
          </aside>

          {active && prepared ? (
            <section className="stage">
              <div className="stage-head">
                <label className="item-id">
                  <span>Item id</span>
                  <input
                    list="set-item-ids"
                    value={active.itemId}
                    onChange={(e) => updateImage(active.key, { itemId: toSnakeId(e.target.value) || active.itemId })}
                  />
                  <datalist id="set-item-ids">
                    {set?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </datalist>
                </label>
                <span className="hint">
                  {setItem ? `${setItem.name}${setItem.tier ? ` · ${setItem.tier}` : ''} → ${itemFileName(setItem, active.itemId)}` : set ? 'Sette yok' : active.fileName}
                  {activeGroup && activeGroup.images.length > 1 && ` · ${activeGroup.images.length} aday`}
                </span>
                <div className="row status-row">
                  <button type="button" className={`btn ${active.status === 'approved' ? 'btn-approve' : ''}`}
                    onClick={() => setStatus(active, active.status === 'approved' ? 'pending' : 'approved')}>
                    ✓ Approve (A)
                  </button>
                  <button type="button" className={`btn ${active.status === 'rejected' ? 'btn-reject' : ''}`}
                    onClick={() => setStatus(active, active.status === 'rejected' ? 'pending' : 'rejected')}>
                    ✕ Reject (X)
                  </button>
                  <button type="button" className="btn" onClick={() => void exportOne()}>PNG</button>
                  <button type="button" className="btn btn-danger" onClick={() => removeImage(active.key)}>Remove</button>
                </div>
              </div>

              <div className="compare">
                <figure>
                  <div className={`canvas-box ${erasing ? 'erasing' : ''}`}>
                    <PixelCanvas buffer={active.source} className="fit" onPixelClick={handleSourceClick} />
                  </div>
                  <figcaption>Original · {active.source.width}×{active.source.height}</figcaption>
                </figure>
                <figure>
                  <div className={`canvas-box ${erasing ? 'erasing' : ''}`}>
                    <PixelCanvas buffer={prepared.buffer} className="fit" onPixelClick={handlePreparedClick} />
                  </div>
                  <figcaption>
                    Game icon · {prepared.buffer.width}×{prepared.buffer.height} · {countColors(prepared.buffer.data)} colors
                  </figcaption>
                </figure>
              </div>

              <div className="sizes">
                {GAME_SIZES.map((size) => (
                  <figure key={size}>
                    <PixelCanvas buffer={prepared.buffer} displaySize={size} className="pixel" />
                    <figcaption>{size}px</figcaption>
                  </figure>
                ))}
                <p className="hint">Oyunda görüneceği boyutlar. A onayla · X reddet · ←/→ gez · E silgi</p>
              </div>
            </section>
          ) : (
            <section className="stage">
              <p className="hint">Listeden bir görsel seç, PNG ekle ya da Ctrl+V ile yapıştır.</p>
            </section>
          )}

          <aside className="side">
            {active && (
              <PrepareInspector
                prepare={active.prepare}
                paletteName={palette.name}
                paletteSize={palette.colors.length}
                erasing={erasing}
                onChange={changePrepare}
                onToggleEraser={() => setErasing((e) => !e)}
                onPaletteFile={(file) => void importFiles([file])}
                imageCount={images.length}
                onApplyToAll={() => setProject((p) => ({
                  ...p,
                  // Silgi noktaları görsele özel, onlar korunur.
                  images: p.images.map((i) => ({ ...i, prepare: { ...active.prepare, erasePoints: i.prepare.erasePoints } })),
                }))}
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
