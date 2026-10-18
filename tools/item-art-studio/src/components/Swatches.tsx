interface SwatchesProps {
  colors: string[]
  value: string | null
  onPick: (hex: string | null) => void
  allowNone?: boolean
  noneLabel?: string
  // Paletin dışından renk seçmek için (palet kapalıyken).
  allowCustom?: boolean
}

export function Swatches({ colors, value, onPick, allowNone, noneLabel = 'None', allowCustom }: SwatchesProps) {
  return (
    <div className="swatches">
      {allowNone && (
        <button
          type="button"
          className={`swatch none ${value === null ? 'selected' : ''}`}
          title={noneLabel}
          onClick={() => onPick(null)}
        >
          ∅
        </button>
      )}
      {colors.map((hex) => (
        <button
          type="button"
          key={hex}
          title={hex}
          className={`swatch ${value === hex ? 'selected' : ''}`}
          style={{ backgroundColor: hex }}
          onClick={() => onPick(hex)}
        />
      ))}
      {allowCustom && (
        <label className="swatch custom" title="Custom color">
          +
          <input type="color" value={value ?? '#40A0FF'} onChange={(e) => onPick(e.target.value.toUpperCase())} />
        </label>
      )}
    </div>
  )
}
