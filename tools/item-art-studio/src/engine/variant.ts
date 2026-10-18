import { colorName, rgbToLch } from './color'
import {
  applyPattern,
  contrast,
  fillMask,
  groupMask,
  opaqueMask,
  outlineMask,
  rimLight,
  sparkle,
  subtractMask,
  tint,
  type PatternId,
} from './effects'
import { cloneBuffer, hexToRgb, rgbToHex, type PixelBuffer, type Rgb } from './pixels'
import { quantizeToPalette } from './quantize'
import { applyEdits } from './recolor'

export type MaterialId = 'none' | 'matte' | 'glossy' | 'metal' | 'gold' | 'silver' | 'dark'
export type VariantStatus = 'pending' | 'approved' | 'rejected'
export type VariantOrigin = 'set' | 'manual' | 'random'

export interface MaterialInfo {
  id: MaterialId
  label: string
  hint: string
}

export const MATERIALS: MaterialInfo[] = [
  { id: 'none', label: 'Original', hint: 'Malzeme efekti yok' },
  { id: 'matte', label: 'Matte', hint: 'Düşük kontrast, soluk' },
  { id: 'glossy', label: 'Glossy', hint: 'Sol üst kenarda ışık, küçük parlama' },
  { id: 'metal', label: 'Metal', hint: 'Yüksek kontrast, az renk, kenar ışığı' },
  { id: 'gold', label: 'Gold', hint: 'Altın tonu + metal' },
  { id: 'silver', label: 'Silver', hint: 'Gümüş tonu + metal' },
  { id: 'dark', label: 'Dark', hint: 'Koyu, gölgeli' },
]

export const PATTERNS: Array<{ id: PatternId; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'checker', label: 'Checker' },
  { id: 'dots', label: 'Dots' },
]

export interface VariantSpec {
  // Dosya adı da olan eşya id'si (snake_case).
  id: string
  name: string
  origin: VariantOrigin
  status: VariantStatus
  // Gölgeyi koruyarak boyama rengi. null = boyama yok.
  tint: string | null
  // Boş = bütün eşya; dolu = yalnızca bu renk grupları.
  tintGroups: string[]
  keepOutline: boolean
  // Renk grubu anahtarı -> düz hedef renk (ince ayar).
  replacements: Record<string, string>
  material: MaterialId
  pattern: PatternId
  patternColor: string | null
  outlineColor: string | null
  brightness: number
  saturation: number
}

export function createVariant(id: string, name: string, origin: VariantOrigin, tintColor: string | null = null): VariantSpec {
  return {
    id,
    name,
    origin,
    status: 'pending',
    tint: tintColor,
    tintGroups: [],
    keepOutline: true,
    replacements: {},
    material: 'none',
    pattern: 'none',
    patternColor: null,
    outlineColor: null,
    brightness: 100,
    saturation: 100,
  }
}

// Düzenlemeleri sıfırlar, kimlik bilgilerini korur.
export function resetVariant(spec: VariantSpec): VariantSpec {
  const fresh = createVariant(spec.id, spec.name, spec.origin)
  return { ...fresh, status: spec.status }
}

const GOLD: Rgb = [0xf9, 0xc2, 0x2b]
const SILVER: Rgb = [0xb4, 0xc0, 0xc4]

function applyMaterial(buffer: PixelBuffer, body: Uint8Array, material: MaterialId): void {
  switch (material) {
    case 'matte':
      contrast(buffer, body, 0.7, 0.75)
      break
    case 'glossy':
      rimLight(buffer, body, 0.16)
      sparkle(buffer, body, 0.3)
      break
    case 'metal':
      contrast(buffer, body, 1.35, 0.55)
      rimLight(buffer, body, 0.18, 0.1)
      sparkle(buffer, body, 0.3)
      break
    case 'gold':
      tint(buffer, body, GOLD)
      contrast(buffer, body, 1.3, 1)
      rimLight(buffer, body, 0.15, 0.1)
      sparkle(buffer, body, 0.25)
      break
    case 'silver':
      tint(buffer, body, SILVER)
      contrast(buffer, body, 1.4, 0.4)
      rimLight(buffer, body, 0.2, 0.12)
      sparkle(buffer, body, 0.3)
      break
    case 'dark':
      contrast(buffer, body, 0.9, 0.85, -0.18)
      break
    case 'none':
      break
  }
}

// Bir varyantın son hali. Sıra: düz renk değişiklikleri → gölgeli boyama →
// malzeme → desen → kontur → parlaklık/doygunluk → palete çekme.
// Maskeler temel görselden hesaplanır, efektler birbirinin maskesini bozmaz.
export function renderVariant(
  base: PixelBuffer,
  spec: VariantSpec,
  tolerance: number,
  palette: Rgb[] | null,
): PixelBuffer {
  let out = applyEdits(base, { tolerance, replacements: spec.replacements, brightness: 100, saturation: 100 })

  const opaque = opaqueMask(base)
  const outline = outlineMask(base)
  const body = spec.keepOutline ? subtractMask(opaque, outline) : opaque

  const tintRgb = spec.tint ? hexToRgb(spec.tint) : null
  if (tintRgb) {
    const mask = spec.tintGroups.length > 0
      ? subtractMask(groupMask(base, spec.tintGroups, tolerance), spec.keepOutline ? outline : new Uint8Array(outline.length))
      : body
    tint(out, mask, tintRgb)
  }

  applyMaterial(out, body, spec.material)

  const patternRgb = spec.patternColor ? hexToRgb(spec.patternColor) : null
  if (patternRgb) applyPattern(out, body, spec.pattern, patternRgb)

  const outlineRgb = spec.outlineColor ? hexToRgb(spec.outlineColor) : null
  if (outlineRgb) fillMask(out, outline, outlineRgb)

  if (spec.brightness !== 100 || spec.saturation !== 100) {
    out = applyEdits(out, { tolerance, replacements: {}, brightness: spec.brightness, saturation: spec.saturation })
  } else {
    out = cloneBuffer(out)
  }

  return palette && palette.length > 0 ? quantizeToPalette(out, palette) : out
}

// --- Rastgele varyant üretimi ---------------------------------------------

export type Random = () => number

// Tekrarlanabilir sonuç için küçük, tohumlu RNG (mulberry32).
export function seededRandom(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(rng: Random, entries: Array<[T, number]>): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [value, weight] of entries) {
    roll -= weight
    if (roll < 0) return value
  }
  return entries[entries.length - 1][0]
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const id = `${base}_${n}`
    if (!taken.has(id)) return id
  }
}

function titleCase(text: string): string {
  return text.replace(/(^|_)([a-z])/g, (_, sep: string, ch: string) => (sep ? ' ' : '') + ch.toUpperCase())
}

// Var olan varyantlardan farklı renk tonlarında öneriler üretir. Renkler
// paletten seçilir; palet yoksa rastgele tonlar kullanılır.
export function generateRandomVariants(
  count: number,
  baseId: string,
  palette: Rgb[],
  existing: VariantSpec[],
  rng: Random = Math.random,
): VariantSpec[] {
  const candidates: Rgb[] = palette.filter((rgb) => {
    const { l, c } = rgbToLch(rgb)
    return c > 0.06 && l > 0.45 && l < 0.88
  })
  if (candidates.length === 0) {
    for (let h = 0; h < 360; h += 20) candidates.push(lchFallback(h))
  }

  const usedHues = existing
    .map((v) => (v.tint ? hexToRgb(v.tint) : null))
    .filter((rgb): rgb is Rgb => rgb !== null)
    .map((rgb) => rgbToLch(rgb).h)

  const taken = new Set(existing.map((v) => v.id))
  const result: VariantSpec[] = []

  for (let n = 0; n < count; n++) {
    // Kullanılmış tonlardan en uzak birkaç adaydan birini seç.
    const scored = candidates
      .map((rgb) => {
        const h = rgbToLch(rgb).h
        const nearest = usedHues.length ? Math.min(...usedHues.map((u) => hueDistance(u, h))) : 180
        return { rgb, score: nearest + rng() * 40 }
      })
      .sort((a, b) => b.score - a.score)
    const pick = scored[Math.floor(rng() * Math.min(4, scored.length))].rgb
    usedHues.push(rgbToLch(pick).h)

    const material = pickWeighted<MaterialId>(rng, [
      ['none', 45], ['glossy', 18], ['matte', 10], ['metal', 10], ['gold', 6], ['silver', 6], ['dark', 5],
    ])
    const pattern = rng() < 0.15 ? pickWeighted<PatternId>(rng, [['stripes', 1], ['checker', 1], ['dots', 1]]) : 'none'

    let patternColor: string | null = null
    if (pattern !== 'none') {
      const h = rgbToLch(pick).h
      const contrastColors = candidates.filter((rgb) => hueDistance(rgbToLch(rgb).h, h) > 60)
      const pc = contrastColors.length ? contrastColors[Math.floor(rng() * contrastColors.length)] : pick
      patternColor = rgbToHex(...pc)
    }

    const tintColor = material === 'gold' || material === 'silver' ? null : rgbToHex(...pick)
    const label = material === 'gold' || material === 'silver' ? material : colorName(pick)
    const suffix = material !== 'none' && material !== 'gold' && material !== 'silver' ? `_${material}` : ''
    const id = uniqueId(`${baseId}_${label}${suffix}`, taken)
    taken.add(id)

    const spec = createVariant(id, titleCase(`${label}${suffix}_${baseId}`), 'random', tintColor)
    result.push({ ...spec, material, pattern, patternColor })
  }

  return result
}

function lchFallback(h: number): Rgb {
  const rad = (h * Math.PI) / 180
  // Basit HSL benzeri yedek; palet yoksa kullanılır.
  const r = Math.round(128 + 100 * Math.cos(rad))
  const g = Math.round(128 + 100 * Math.cos(rad - 2.094))
  const b = Math.round(128 + 100 * Math.cos(rad + 2.094))
  return [r, g, b]
}
