import { paddingFor, type PrepareSettings } from '../engine/pipeline'

// 128: collection item. 16 / 8: UI icons (HUD, menu, emote / inline coin, dust).
const SIZES = [
  { size: 128, label: 'Item 128' },
  { size: 32, label: '32' },
  { size: 16, label: 'Icon 16' },
  { size: 8, label: 'Inline 8' },
]

interface Props {
  prepare: PrepareSettings
  paletteName: string
  paletteSize: number
  erasing: boolean
  onChange: (change: Partial<PrepareSettings>) => void
  onToggleEraser: () => void
  onPaletteFile: (file: File) => void
  onApplyToAll: () => void
  imageCount: number
}

export function PrepareInspector({
  prepare, paletteName, paletteSize, erasing, onChange, onToggleEraser, onPaletteFile, onApplyToAll, imageCount,
}: Props) {
  return (
    <div className="inspector">
      <section className="group">
        <h3>1 · Background</h3>
        <label className="check">
          <input type="checkbox" checked={prepare.removeBackground} onChange={(e) => onChange({ removeBackground: e.target.checked })} />
          Remove flat background
        </label>
        {prepare.removeBackground && (
          <label className="slider">
            <span>Tolerance <b>{prepare.backgroundTolerance}</b></span>
            <input type="range" min="0" max="128" value={prepare.backgroundTolerance}
              onChange={(e) => onChange({ backgroundTolerance: Number(e.target.value) })} />
          </label>
        )}
        <div className="row">
          <button type="button" className={`btn ${erasing ? 'btn-active' : ''}`} onClick={onToggleEraser}>
            {erasing ? 'Eraser on (E)' : 'Magic eraser (E)'}
          </button>
          <button type="button" className="btn" disabled={prepare.erasePoints.length === 0}
            onClick={() => onChange({ erasePoints: prepare.erasePoints.slice(0, -1) })}>
            Undo
          </button>
          <button type="button" className="btn" disabled={prepare.erasePoints.length === 0}
            onClick={() => onChange({ erasePoints: [] })}>
            Clear ({prepare.erasePoints.length})
          </button>
        </div>
        {erasing && (
          <label className="slider">
            <span>Eraser tolerance <b>{prepare.eraseTolerance}</b></span>
            <input type="range" min="0" max="128" value={prepare.eraseTolerance}
              onChange={(e) => onChange({ eraseTolerance: Number(e.target.value) })} />
          </label>
        )}
        <p className="hint">Silgi açıkken görsele tıkla: tıklanan renge benzeyen bitişik alan silinir.</p>
      </section>

      <section className="group">
        <h3>2 · Size</h3>
        <label className="check">
          <input type="checkbox" checked={prepare.resize} onChange={(e) => onChange({ resize: e.target.checked })} />
          Center and fit to {prepare.size} × {prepare.size}
        </label>
        {prepare.resize && (
          <div className="row">
            {SIZES.map(({ size, label }) => (
              <button key={size} type="button" className={`btn ${prepare.size === size ? 'btn-active' : ''}`}
                onClick={() => onChange({ size, padding: paddingFor(size) })}>
                {label}
              </button>
            ))}
          </div>
        )}
        {prepare.resize && (
          <label className="slider">
            <span>Padding <b>{prepare.padding}px</b></span>
            <input type="range" min="0" max={Math.max(1, Math.floor(prepare.size / 8))} value={prepare.padding}
              onChange={(e) => onChange({ padding: Number(e.target.value) })} />
          </label>
        )}
      </section>

      <section className="group">
        <h3>3 · Palette</h3>
        <label className="check">
          <input type="checkbox" checked={prepare.quantize} onChange={(e) => onChange({ quantize: e.target.checked })} />
          Snap to game palette
        </label>
        <p className="hint">{paletteName} · {paletteSize} colors</p>
        <label className="btn btn-file">
          Load other .hex
          <input type="file" accept=".hex,text/plain" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPaletteFile(f) }} />
        </label>
      </section>

      {imageCount > 1 && (
        <button type="button" className="btn btn-wide" onClick={onApplyToAll}>
          Use these settings for all {imageCount} images
        </button>
      )}
    </div>
  )
}
