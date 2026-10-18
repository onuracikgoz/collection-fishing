import { DEFAULT_PREPARE, type PrepareSettings } from '../engine/pipeline'
import type { ImageEntry } from './project'

// `<item_id>.studio.json`: bir görselin hazırlama ayarları. Aynı kaynak PNG
// ile yüklenince aynı ikon yeniden üretilir.
export const STUDIO_FORMAT = 'item-art-studio/2'

export interface StudioFile {
  format: typeof STUDIO_FORMAT
  set_id: string | null
  item_id: string
  source_image: string
  palette: string
  prepare: PrepareSettings
}

export function toStudioFile(image: ImageEntry, setId: string | null, paletteName: string): StudioFile {
  return {
    format: STUDIO_FORMAT,
    set_id: setId,
    item_id: image.itemId,
    source_image: image.fileName,
    palette: image.prepare.quantize ? paletteName : '',
    prepare: image.prepare,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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

export function isStudioText(text: string): boolean {
  return text.includes('"item-art-studio/')
}

export function parseStudioFile(text: string): StudioFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('studio.json geçerli bir JSON değil.')
  }
  if (!isObject(raw) || raw.format !== STUDIO_FORMAT) {
    throw new Error('Bu dosya bu sürümün Item Art Studio dosyası değil.')
  }
  if (typeof raw.item_id !== 'string' || !raw.item_id) {
    throw new Error('studio.json içinde item_id yok.')
  }
  return {
    format: STUDIO_FORMAT,
    set_id: typeof raw.set_id === 'string' ? raw.set_id : null,
    item_id: raw.item_id,
    source_image: typeof raw.source_image === 'string' ? raw.source_image : '',
    palette: typeof raw.palette === 'string' ? raw.palette : '',
    prepare: parsePrepare(raw.prepare),
  }
}
