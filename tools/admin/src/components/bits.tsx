import type { ReactNode } from 'react'
import type { ArtReport } from '../artCheck'
import { dataUrl } from '../images'

export const TIER_LABEL: Record<string, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' }
export const TYPE_LABEL: Record<string, string> = {
  item: 'Eşya (Float + Tier)',
  fish: 'Sıradan balık (görev balığı)',
  junk: 'Çöp',
  material: 'Craft malzemesi',
  bait: 'Yem',
  recipe: 'Recipe',
}
export const BAND_LABEL: Record<string, string> = { shore: 'Kıyı', mid: 'Orta', deep: 'Derin' }
export const CATEGORY_LABEL: Record<string, string> = {
  junk: 'Çöp',
  fish: 'Sıradan balık',
  common: 'Common',
  material: 'Malzeme',
  rare: 'Rare',
  epic: 'Epic',
  recipe: 'Recipe',
  legendary: 'Legendary',
  mythic: 'Mythic',
}

export function Thumb({ png, size = 32, tier }: { png?: string; size?: number; tier?: string | null }) {
  return (
    <span className={`thumb tier-${tier ?? 'none'}`} style={{ width: size, height: size }}>
      {png ? <img src={dataUrl(png)} width={size} height={size} alt="" /> : <span className="thumb-empty">?</span>}
    </span>
  )
}

export function Toggles<T extends string>({ options, value, onChange, labels, emptyText }: { options: T[]; value: T[]; onChange: (v: T[]) => void; labels?: Record<string, string>; emptyText?: string }) {
  return (
    <span className="toggles">
      {options.map((o) => (
        <label key={o} className={value.includes(o) ? 'on' : ''}>
          <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
          {labels?.[o] ?? o}
        </label>
      ))}
      {value.length === 0 && emptyText ? <span className="muted">{emptyText}</span> : null}
    </span>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">{children}</span>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function Report({ report }: { report?: ArtReport }) {
  if (!report) return <p className="muted">Görsel yok.</p>
  return (
    <ul className="report">
      {report.lines.map((l, i) => (
        <li key={i} className={`lvl-${l.level}`}>
          {l.level === 'ok' ? '✓' : l.level === 'warn' ? '!' : '✗'} {l.text}
        </li>
      ))}
    </ul>
  )
}

/** The image at game sizes on a checkerboard and on the bag colour. */
export function ArtView({ png, report }: { png?: string; report?: ArtReport }) {
  return (
    <div className="artview">
      <div className="artview-sizes">
        {png ? (
          <>
            <div className="checker big">
              <img src={dataUrl(png)} width={256} height={256} alt="" />
            </div>
            <div className="sizes">
              {[96, 48, 32].map((s) => (
                <div key={s} className="bagslot">
                  <img src={dataUrl(png)} width={s} height={s} alt="" />
                  <span>{s}px</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="checker big empty">Görsel yok</div>
        )}
      </div>
      <Report report={report} />
    </div>
  )
}

export function StatusTag({ status, active }: { status: string; active: boolean }) {
  if (status === 'draft') return <span className="tag draft">Onay bekliyor</span>
  return active ? <span className="tag live">Oyunda</span> : <span className="tag off">Pasif</span>
}
