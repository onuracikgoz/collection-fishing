import type { PaletteColor } from '../engine/colorMapping'
import { MATERIALS, PATTERNS, type VariantSpec } from '../engine/variant'
import { Swatches } from './Swatches'

interface Props {
  spec: VariantSpec
  idLocked: boolean
  targetColor: string | null
  paletteHex: string[]
  usePalette: boolean
  groups: PaletteColor[]
  selectedGroup: string | null
  tolerance: number
  onChange: (change: Partial<VariantSpec>) => void
  onSelectGroup: (key: string | null) => void
  onTolerance: (value: number) => void
  onReset: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExportOne: () => void
}

export function VariantInspector({
  spec, idLocked, targetColor, paletteHex, usePalette, groups, selectedGroup, tolerance,
  onChange, onSelectGroup, onTolerance, onReset, onDuplicate, onDelete, onExportOne,
}: Props) {
  const selectedReplacement = selectedGroup ? spec.replacements[selectedGroup] ?? null : null
  const inTintScope = selectedGroup ? spec.tintGroups.includes(selectedGroup) : false

  function setReplacement(hex: string | null) {
    if (!selectedGroup) return
    const replacements = { ...spec.replacements }
    if (hex) replacements[selectedGroup] = hex
    else delete replacements[selectedGroup]
    onChange({ replacements })
  }

  function toggleTintScope() {
    if (!selectedGroup) return
    onChange({
      tintGroups: inTintScope ? spec.tintGroups.filter((k) => k !== selectedGroup) : [...spec.tintGroups, selectedGroup],
    })
  }

  return (
    <div className="inspector">
      <section className="group">
        <label className="field">
          <span>Name</span>
          <input type="text" value={spec.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>ID / file name</span>
          <input type="text" value={spec.id} disabled={idLocked}
            title={idLocked ? 'Set dosyasından geliyor' : undefined}
            onChange={(e) => onChange({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_') })} />
        </label>
        <div className="row status-row">
          <button type="button" className={`btn ${spec.status === 'approved' ? 'btn-approve' : ''}`}
            onClick={() => onChange({ status: spec.status === 'approved' ? 'pending' : 'approved' })}>
            ✓ Approve (A)
          </button>
          <button type="button" className={`btn ${spec.status === 'rejected' ? 'btn-reject' : ''}`}
            onClick={() => onChange({ status: spec.status === 'rejected' ? 'pending' : 'rejected' })}>
            ✕ Reject (X)
          </button>
        </div>
      </section>

      <section className="group">
        <h3>Color</h3>
        {targetColor && (
          <p className="hint">
            Set target: <span className="inline-swatch" style={{ backgroundColor: targetColor }} /> {targetColor}
            {spec.tint !== targetColor && (
              <button type="button" className="link" onClick={() => onChange({ tint: targetColor })}>use</button>
            )}
          </p>
        )}
        <Swatches colors={paletteHex} value={spec.tint} onPick={(hex) => onChange({ tint: hex })}
          allowNone noneLabel="Original colors" allowCustom={!usePalette} />
        <label className="check">
          <input type="checkbox" checked={spec.keepOutline} onChange={(e) => onChange({ keepOutline: e.target.checked })} />
          Keep dark outline
        </label>
        <p className="hint">
          {spec.tintGroups.length === 0
            ? 'Bütün eşya boyanır, ışık-gölge korunur.'
            : `Yalnızca seçili ${spec.tintGroups.length} renk grubu boyanır.`}
        </p>
      </section>

      <section className="group">
        <h3>Material</h3>
        <div className="chips">
          {MATERIALS.map((m) => (
            <button type="button" key={m.id} title={m.hint}
              className={`chip ${spec.material === m.id ? 'chip-on' : ''}`}
              onClick={() => onChange({ material: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h3>Pattern &amp; outline</h3>
        <div className="chips">
          {PATTERNS.map((p) => (
            <button type="button" key={p.id}
              className={`chip ${spec.pattern === p.id ? 'chip-on' : ''}`}
              onClick={() => onChange({ pattern: p.id, patternColor: spec.patternColor ?? paletteHex[0] ?? '#FFFFFF' })}>
              {p.label}
            </button>
          ))}
        </div>
        {spec.pattern !== 'none' && (
          <Swatches colors={paletteHex} value={spec.patternColor} onPick={(hex) => onChange({ patternColor: hex })} allowCustom={!usePalette} />
        )}
        <p className="hint">Outline color</p>
        <Swatches colors={paletteHex} value={spec.outlineColor} onPick={(hex) => onChange({ outlineColor: hex })}
          allowNone noneLabel="Keep outline" allowCustom={!usePalette} />
      </section>

      <section className="group">
        <h3>Fine-tune colors</h3>
        <p className="hint">Bir renk grubuna (veya görsele) tıkla: düz renkle değiştir ya da boyamayı o gruba sınırla.</p>
        <div className="group-grid">
          {groups.slice(0, 40).map((g) => (
            <button type="button" key={g.key} title={`${g.hex} · ${g.count}px`}
              className={`group-chip ${selectedGroup === g.key ? 'selected' : ''} ${spec.tintGroups.includes(g.key) ? 'scoped' : ''}`}
              onClick={() => onSelectGroup(selectedGroup === g.key ? null : g.key)}>
              <span style={{ backgroundColor: g.hex }} />
              {spec.replacements[g.key] && <span className="group-new" style={{ backgroundColor: spec.replacements[g.key] }} />}
            </button>
          ))}
        </div>
        {selectedGroup && (
          <div className="subgroup">
            <button type="button" className={`btn ${inTintScope ? 'btn-active' : ''}`} onClick={toggleTintScope}>
              {inTintScope ? 'Tinted (remove)' : 'Tint only this group'}
            </button>
            <p className="hint">Replace with flat color</p>
            <Swatches colors={paletteHex} value={selectedReplacement} onPick={setReplacement}
              allowNone noneLabel="Keep" allowCustom={!usePalette} />
          </div>
        )}
        <label className="slider">
          <span>Grouping <b>{tolerance}</b></span>
          <input type="range" min="1" max="64" value={tolerance} onChange={(e) => onTolerance(Number(e.target.value))} />
        </label>
        <p className="hint">Değiştirmek bu görselin ince ayarlarını (düz renk, grup seçimi) temizler.</p>
      </section>

      <section className="group">
        <h3>Light</h3>
        <label className="slider">
          <span>Brightness <b>{spec.brightness}%</b></span>
          <input type="range" min="50" max="150" value={spec.brightness} onChange={(e) => onChange({ brightness: Number(e.target.value) })} />
        </label>
        <label className="slider">
          <span>Saturation <b>{spec.saturation}%</b></span>
          <input type="range" min="0" max="200" value={spec.saturation} onChange={(e) => onChange({ saturation: Number(e.target.value) })} />
        </label>
      </section>

      <div className="row">
        <button type="button" className="btn" onClick={onReset}>Reset All</button>
        <button type="button" className="btn" onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="btn" onClick={onExportOne}>PNG</button>
        {!idLocked && <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}
