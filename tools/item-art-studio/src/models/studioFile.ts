import { DEFAULT_TOLERANCE } from '../engine/colorMapping'
import type { PatternId } from '../engine/effects'
import { DEFAULT_PREPARE, type PrepareSettings } from '../engine/pipeline'
import {
  createVariant,
  MATERIALS,
  PATTERNS,
  type MaterialId,
  type VariantSpec,
} from '../engine/variant'
import type { BaseEntry } from './project'

// `<base_id>.studio.json`: bir temel tasarımın hazırlama ayarları ve bütün
// varyantları. Aynı kaynak PNG ile yüklenince aynı çıktılar yeniden üretilir.
export const STUDIO_FORMAT = 'item-art-studio/1'

export interface StudioFile {
  format: typeof STUDIO_FORMAT
  set_id: string | null
  base_id: string
  source_image: string
  palette: string
  prepare: PrepareSettings
  tolerance: number
  variants: VariantSpec[]
}

export function toStudioFile(base: BaseEntry, setId: string | null, paletteName: string): StudioFile {
  return {
    format: STUDIO_FORMAT,
    set_id: setId,
    base_id: base.baseId,
    source_image: base.fileName,
    palette: base.prepare.quantize ? paletteName : '',
    prepare: base.prepare,
    tolerance: base.tolerance,
    variants: base.variants,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function hex(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function parsePrepare(value: unknown): PrepareSettings {
  if (!isObject(value)) return { ...DEFAULT_PREPARE, erasePoints: [] }
  const points = Array.isArray(value.erasePoints)
    ? value.erasePoints.filter(isObject).map((p) => ({ x: num(p.x, -1), y: num(p.y, -1) }))
    : []
  return {
    removeBackground: bool(value.removeBackground, DEFAULT_PREPARE.removeBackground),
    backgroundTolerance: num(value.backgroundTolerance, DEFAULT_PREPARE.backgroundTolerance),
    erasePoints: points.filter((p) => p.x >= 0 && p.y >= 0),
    eraseTolerance: num(value.eraseTolerance, DEFAULT_PREPARE.eraseTolerance),
    resize: bool(value.resize, DEFAULT_PREPARE.resize),
    size: num(value.size, DEFAULT_PREPARE.size),
    padding: num(value.padding, DEFAULT_PREPARE.padding),
    quantize: bool(value.quantize, DEFAULT_PREPARE.quantize),
  }
}

function parseVariant(value: unknown): VariantSpec | null {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id) return null
  const origin = value.origin === 'set' || value.origin === 'random' ? value.origin : 'manual'
  const spec = createVariant(value.id, typeof value.name === 'string' ? value.name : value.id, origin)
  const replacements: Record<string, string> = {}
  if (isObject(value.replacements)) {
    for (const [key, color] of Object.entries(value.replacements)) {
      const h = hex(color)
      if (h) replacements[key] = h
    }
  }
  const material = MATERIALS.some((m) => m.id === value.material) ? (value.material as MaterialId) : 'none'
  const pattern = PATTERNS.some((p) => p.id === value.pattern) ? (value.pattern as PatternId) : 'none'
  const status = value.status === 'approved' || value.status === 'rejected' ? value.status : 'pending'
  return {
    ...spec,
    status,
    tint: hex(value.tint),
    tintGroups: Array.isArray(value.tintGroups) ? value.tintGroups.filter((k): k is string => typeof k === 'string') : [],
    keepOutline: bool(value.keepOutline, true),
    replacements,
    material,
    pattern,
    patternColor: hex(value.patternColor),
    outlineColor: hex(value.outlineColor),
    brightness: num(value.brightness, 100),
    saturation: num(value.saturation, 100),
  }
}

export function parseStudioFile(text: string): StudioFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('studio.json geçerli bir JSON değil.')
  }
  if (!isObject(raw) || raw.format !== STUDIO_FORMAT) {
    throw new Error('Bu dosya bir Item Art Studio dosyası değil.')
  }
  if (typeof raw.base_id !== 'string' || !raw.base_id) {
    throw new Error('studio.json içinde base_id yok.')
  }
  const variants = Array.isArray(raw.variants)
    ? raw.variants.map(parseVariant).filter((v): v is VariantSpec => v !== null)
    : []
  return {
    format: STUDIO_FORMAT,
    set_id: typeof raw.set_id === 'string' ? raw.set_id : null,
    base_id: raw.base_id,
    source_image: typeof raw.source_image === 'string' ? raw.source_image : '',
    palette: typeof raw.palette === 'string' ? raw.palette : '',
    prepare: parsePrepare(raw.prepare),
    tolerance: num(raw.tolerance, DEFAULT_TOLERANCE),
    variants,
  }
}
