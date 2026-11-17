// Wardrobe: wearable cosmetics (docs/tasarim/20-gardirop.md, docs/protokol.md Gardırop).
// Parts and colours are content data; a player's wardrobe is a list of owned items plus the
// look they saved. Pure functions, no Nakama dependency.
import { Tier } from './catch';

export type Body = 'male' | 'female';
export const BODIES: Body[] = ['male', 'female'];
export type ColorKind = 'dye' | 'hair' | 'metal' | 'gem' | 'fx' | 'skin' | 'eye';
export const COLOR_KINDS: ColorKind[] = ['dye', 'hair', 'metal', 'gem', 'fx', 'skin', 'eye'];
/** Kinds a part can be painted with (fx comes through `effects`, skin and eye are identity). */
const PART_KINDS: ColorKind[] = ['dye', 'hair', 'metal', 'gem'];
export const WEAR_TIERS: Tier[] = ['common', 'rare', 'epic', 'legendary'];
export type WardrobeSource = 'admin' | 'craft' | 'rent_coin' | 'rent_diamond';
export const WARDROBE_SOURCES: WardrobeSource[] = ['admin', 'craft', 'rent_coin', 'rent_diamond'];

export interface WardrobePart {
  /** LPC sheet definition name, e.g. torso_clothes_tshirt. Never renamed. */
  id: string;
  name: string;
  /** One part per slot (the LPC layer type: hair, hat, clothes, wings...). */
  slot: string;
  /** Craft family and wardrobe tab (UST, SAC, KANAT...). */
  family: string;
  /** null for free starter parts. */
  tier: Tier | null;
  /** Colour kinds of the main area; empty = one fixed colour (""). */
  colors: ColorKind[];
  /** Colour kinds of a second area, if the part has one. */
  color2?: ColorKind[];
  /** fx_* colours that make a Mythic copy of this part. */
  effects: string[];
  bodies: Body[];
  /** Starter part: anyone wears it in free colours. */
  free: boolean;
  /** Inactive parts are not offered any more; owned copies still wear. */
  active: boolean;
}

export interface WardrobeColor {
  /** Kind prefix + name: dye_red, hair_blonde, metal_gold, gem_red, fx_rainbow, skin_peach, eye_blue. */
  id: string;
  kind: ColorKind;
  tier: Tier | null;
  /** Usable on free parts without owning anything (skin and eye always). */
  free: boolean;
}

export interface WardrobeCatalog {
  parts: WardrobePart[];
  colors: WardrobeColor[];
}

export interface CompiledWardrobe {
  catalog: WardrobeCatalog;
  parts: { [id: string]: WardrobePart };
  colors: { [id: string]: WardrobeColor };
  /** Free choices for the default look, in catalog order. */
  skins: string[];
  eyes: string[];
}

export interface WardrobeItem {
  instanceId: string;
  part: string;
  color: string;
  color2?: string;
  source: WardrobeSource;
  obtainedAt: number;
  /** Rented until (ms); missing = permanent. */
  until?: number;
  /** Locked items never trade, sell or go to a stall. Rented ones are always locked. */
  locked: boolean;
}

/** One worn part. instanceId is the owned item behind it; free parts have none. */
export interface LookPart {
  part: string;
  color: string;
  color2?: string;
  instanceId?: string;
}

export interface StoredLook {
  body: Body;
  skin: string;
  eyes: string;
  parts: LookPart[];
}

/** What other players see (protocol `Look`). */
export interface LookView {
  body: Body;
  skin: string;
  eyes: string;
  parts: { part: string; color: string; color2?: string; rented?: boolean }[];
}

export interface WardrobeDoc {
  items: WardrobeItem[];
  /** null until the player saves a look; then the default look is used. */
  look: StoredLook | null;
}

export const ID_RE = /^[a-z0-9_]{1,64}$/;

const isObj = (v: unknown): v is { [k: string]: unknown } => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function compileWardrobe(catalog: WardrobeCatalog): CompiledWardrobe {
  const parts: { [id: string]: WardrobePart } = {};
  const colors: { [id: string]: WardrobeColor } = {};
  for (const p of catalog.parts) parts[p.id] = p;
  for (const c of catalog.colors) colors[c.id] = c;
  return {
    catalog,
    parts,
    colors,
    skins: catalog.colors.filter((c) => c.kind === 'skin').map((c) => c.id),
    eyes: catalog.colors.filter((c) => c.kind === 'eye').map((c) => c.id),
  };
}

/** Errors in a wardrobe catalog (empty = valid). */
export function validateWardrobe(cat: unknown): string[] {
  const errors: string[] = [];
  const err = (m: string) => {
    if (errors.length < 100) errors.push(m);
  };
  if (!isObj(cat) || !Array.isArray(cat.parts) || !Array.isArray(cat.colors)) return ['wardrobe needs parts and colors lists'];
  const colorIds: { [id: string]: ColorKind } = {};
  for (const c of cat.colors as unknown[]) {
    if (!isObj(c) || typeof c.id !== 'string' || !ID_RE.test(c.id)) {
      err('wardrobe colour with a bad id');
      continue;
    }
    if (has(colorIds, c.id)) err(`wardrobe colour ${c.id} twice`);
    if (COLOR_KINDS.indexOf(c.kind as ColorKind) < 0) err(`wardrobe colour ${c.id}: unknown kind`);
    else if (c.id.indexOf((c.kind === 'fx' ? 'fx' : c.kind) + '_') !== 0) err(`wardrobe colour ${c.id}: id must start with ${c.kind}_`);
    if (c.tier !== null && ['common', 'rare', 'epic', 'legendary', 'mythic'].indexOf(c.tier as string) < 0) err(`wardrobe colour ${c.id}: bad tier`);
    if (typeof c.free !== 'boolean') err(`wardrobe colour ${c.id}: free must be true or false`);
    colorIds[c.id] = c.kind as ColorKind;
  }
  for (const k of ['skin', 'eye'] as ColorKind[]) {
    if (!Object.keys(colorIds).some((id) => colorIds[id] === k)) err(`wardrobe needs at least one ${k} colour`);
  }
  const partIds: { [id: string]: true } = {};
  const kindList = (where: string, v: unknown): void => {
    if (!Array.isArray(v) || !v.every((k) => PART_KINDS.indexOf(k as ColorKind) >= 0)) err(`${where}: colour kinds must be from ${PART_KINDS.join(', ')}`);
  };
  for (const p of cat.parts as unknown[]) {
    if (!isObj(p) || typeof p.id !== 'string' || !ID_RE.test(p.id)) {
      err('wardrobe part with a bad id');
      continue;
    }
    const w = `wardrobe part ${p.id}`;
    if (partIds[p.id]) err(`${w} twice`);
    partIds[p.id] = true;
    if (typeof p.name !== 'string' || p.name.trim() === '') err(`${w}: name is required`);
    if (typeof p.slot !== 'string' || !ID_RE.test(p.slot)) err(`${w}: bad slot`);
    if (typeof p.family !== 'string' || p.family === '') err(`${w}: family is required`);
    if (typeof p.free !== 'boolean' || typeof p.active !== 'boolean') err(`${w}: free and active must be true or false`);
    if (p.free === true && p.tier !== null) err(`${w}: a free part has no tier`);
    if (p.free !== true && WEAR_TIERS.indexOf(p.tier as Tier) < 0) err(`${w}: tier must be ${WEAR_TIERS.join(', ')}`);
    kindList(w, p.colors);
    if (p.color2 !== undefined) kindList(`${w} color2`, p.color2);
    if (!Array.isArray(p.effects) || !p.effects.every((e) => typeof e === 'string' && colorIds[e] === 'fx')) err(`${w}: effects must be fx colours`);
    if (!Array.isArray(p.bodies) || !p.bodies.every((b) => BODIES.indexOf(b as Body) >= 0)) err(`${w}: bodies must be male / female`);
    else if (p.active === true && p.bodies.length === 0) err(`${w}: an active part needs a body`);
  }
  return errors;
}

/** Does this colour fit this area of the part? "" fits a fixed (colourless) area. */
function colorFits(w: CompiledWardrobe, kinds: ColorKind[] | undefined, color: string, effects: string[] = []): boolean {
  if (!kinds) return color === '';
  if (kinds.length === 0) return color === '' || effects.indexOf(color) >= 0;
  if (effects.indexOf(color) >= 0) return true;
  const c = has(w.colors, color) ? w.colors[color] : undefined;
  return c !== undefined && kinds.indexOf(c.kind) >= 0;
}

/** Can this item exist at all: known part, colours that fit it. */
export function itemFits(w: CompiledWardrobe, part: string, color: string, color2: string | undefined): boolean {
  const p = has(w.parts, part) ? w.parts[part] : undefined;
  if (!p) return false;
  if (!colorFits(w, p.colors, color, p.effects)) return false;
  return p.color2 ? color2 === undefined || colorFits(w, p.color2, color2) : color2 === undefined || color2 === '';
}

/** An item's Tier: Mythic with an effect colour, else the part's. */
export function itemTier(w: CompiledWardrobe, item: Pick<WardrobeItem, 'part' | 'color'>): Tier | null {
  const c = has(w.colors, item.color) ? w.colors[item.color] : undefined;
  if (c && c.kind === 'fx') return 'mythic';
  const p = has(w.parts, item.part) ? w.parts[item.part] : undefined;
  return p ? p.tier : null;
}

/** Can this part be rented (Common-Epic only, karar 16.11.2026)? */
export function rentable(w: CompiledWardrobe, item: Pick<WardrobeItem, 'part' | 'color'>): boolean {
  const t = itemTier(w, item);
  return t === 'common' || t === 'rare' || t === 'epic';
}

export function isExpired(item: WardrobeItem, now: number): boolean {
  return item.until !== undefined && item.until <= now;
}

/** Items still owned at `now` (expired rentals dropped). */
export function liveItems(items: WardrobeItem[], now: number): WardrobeItem[] {
  return items.filter((it) => !isExpired(it, now));
}

// FNV-1a, the same hash the client used for its id-based look, so it stays stable everywhere.
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Free starter look picked from the user id: same everywhere, no storage needed. */
export function defaultLook(w: CompiledWardrobe, userId: string): StoredLook {
  let h = stableHash(userId || '');
  const pick = <T>(list: T[]): T => {
    const v = list[h % list.length];
    h = Math.floor(h / list.length);
    return v;
  };
  const body: Body = pick(BODIES);
  const freeColors = (kind: ColorKind) => w.catalog.colors.filter((c) => c.kind === kind && c.free).map((c) => c.id);
  const look: StoredLook = { body, skin: w.skins.length ? pick(w.skins) : '', eyes: w.eyes.length ? pick(w.eyes) : '', parts: [] };
  const taken: { [slot: string]: true } = {};
  // One free part for each of these slots, if the catalog has one for this body.
  for (const slot of ['hair', 'clothes', 'legs', 'shoes']) {
    const options = w.catalog.parts.filter((p) => p.free && p.active && p.slot === slot && p.bodies.indexOf(body) >= 0 && !taken[p.slot]);
    if (options.length === 0) continue;
    const p = pick(options);
    const colors = p.colors.length ? freeColors(p.colors[0]) : [''];
    if (colors.length === 0) continue;
    look.parts.push({ part: p.id, color: pick(colors) });
    taken[p.slot] = true;
  }
  return look;
}

/** The look to show: the saved one with expired or lost items taken off, else the default. */
export function currentLook(w: CompiledWardrobe, doc: WardrobeDoc | null, userId: string, now: number): StoredLook {
  if (!doc || !doc.look) return defaultLook(w, userId);
  const owned: { [id: string]: WardrobeItem } = {};
  for (const it of liveItems(doc.items, now)) owned[it.instanceId] = it;
  return { ...doc.look, parts: doc.look.parts.filter((p) => p.instanceId === undefined || owned[p.instanceId] !== undefined) };
}

/** Earliest `until` among the worn rented items, or 0. */
export function nextExpiry(doc: WardrobeDoc | null, look: StoredLook): number {
  if (!doc) return 0;
  let next = 0;
  for (const p of look.parts) {
    if (p.instanceId === undefined) continue;
    const it = doc.items.filter((x) => x.instanceId === p.instanceId)[0];
    if (it && it.until !== undefined && (next === 0 || it.until < next)) next = it.until;
  }
  return next;
}

export function lookView(look: StoredLook, doc: WardrobeDoc | null): LookView {
  const rented: { [id: string]: true } = {};
  if (doc) for (const it of doc.items) if (it.until !== undefined) rented[it.instanceId] = true;
  return {
    body: look.body,
    skin: look.skin,
    eyes: look.eyes,
    parts: look.parts.map((p) => {
      const v: LookView['parts'][number] = { part: p.part, color: p.color };
      if (p.color2) v.color2 = p.color2;
      if (p.instanceId !== undefined && rented[p.instanceId]) v.rented = true;
      return v;
    }),
  };
}

/** slot → instanceId of the owned items being worn (get_wardrobe `worn`). */
export function wornMap(w: CompiledWardrobe, look: StoredLook): { [slot: string]: string } {
  const out: { [slot: string]: string } = {};
  for (const p of look.parts) {
    if (p.instanceId !== undefined && has(w.parts, p.part)) out[w.parts[p.part].slot] = p.instanceId;
  }
  return out;
}

export type LookReason = 'NOT_OWNED' | 'BAD_LOOK';

const MAX_PARTS = 40;

/**
 * LOOK_SET: checks the whole outfit against the catalog and what the player owns.
 * Owned parts take their colours from the item; free parts need free colours.
 */
export function applyLookSet(w: CompiledWardrobe, body: unknown, items: WardrobeItem[], now: number): { look: StoredLook } | { reason: LookReason } {
  if (!isObj(body)) return { reason: 'BAD_LOOK' };
  const b = body.body;
  if (b !== 'male' && b !== 'female') return { reason: 'BAD_LOOK' };
  const skin = body.skin;
  const eyes = body.eyes;
  if (typeof skin !== 'string' || !has(w.colors, skin) || w.colors[skin].kind !== 'skin') return { reason: 'BAD_LOOK' };
  if (typeof eyes !== 'string' || !has(w.colors, eyes) || w.colors[eyes].kind !== 'eye') return { reason: 'BAD_LOOK' };
  const list = body.parts === undefined ? [] : body.parts;
  if (!Array.isArray(list) || list.length > MAX_PARTS) return { reason: 'BAD_LOOK' };

  const owned: { [id: string]: WardrobeItem } = {};
  for (const it of liveItems(items, now)) owned[it.instanceId] = it;
  const slots: { [slot: string]: true } = {};
  const parts: LookPart[] = [];
  let notOwned = false;
  for (const raw of list) {
    if (!isObj(raw) || typeof raw.part !== 'string' || !has(w.parts, raw.part)) return { reason: 'BAD_LOOK' };
    const p = w.parts[raw.part];
    if (p.bodies.indexOf(b) < 0 || slots[p.slot]) return { reason: 'BAD_LOOK' };
    slots[p.slot] = true;
    // Unity's JsonUtility sends "" for a missing string.
    const instanceId = typeof raw.instanceId === 'string' && raw.instanceId !== '' ? raw.instanceId : undefined;
    if (instanceId !== undefined) {
      const it = has(owned, instanceId) ? owned[instanceId] : undefined;
      if (!it || it.part !== p.id) {
        notOwned = true;
        continue;
      }
      const lp: LookPart = { part: p.id, color: it.color, instanceId };
      if (it.color2) lp.color2 = it.color2;
      parts.push(lp);
      continue;
    }
    if (!p.free || !p.active) {
      notOwned = true;
      continue;
    }
    const color = typeof raw.color === 'string' ? raw.color : '';
    const color2 = typeof raw.color2 === 'string' && raw.color2 !== '' ? raw.color2 : undefined;
    if (!colorFits(w, p.colors, color) || (p.color2 ? color2 !== undefined && !colorFits(w, p.color2, color2) : color2 !== undefined)) return { reason: 'BAD_LOOK' };
    const freeColor = (c: string) => c === '' || (has(w.colors, c) && w.colors[c].free);
    if (!freeColor(color) || (color2 !== undefined && !freeColor(color2))) {
      notOwned = true;
      continue;
    }
    const lp: LookPart = { part: p.id, color };
    if (color2 !== undefined) lp.color2 = color2;
    parts.push(lp);
  }
  if (notOwned) return { reason: 'NOT_OWNED' };
  return { look: { body: b, skin, eyes, parts } };
}

export interface GiveRequest {
  part: string;
  color: string;
  color2?: string;
  /** Days for a rental; missing = permanent. */
  days?: number;
  locked: boolean;
  source: WardrobeSource;
}

/** A new item, or an error message. Rentals are always locked. */
export function makeItem(w: CompiledWardrobe, req: GiveRequest, instanceId: string, now: number, maxDays: number): WardrobeItem | string {
  if (!has(w.parts, req.part)) return `unknown part ${req.part}`;
  if (!itemFits(w, req.part, req.color, req.color2)) return `colour does not fit ${req.part}`;
  if (WARDROBE_SOURCES.indexOf(req.source) < 0) return 'bad source';
  const item: WardrobeItem = { instanceId, part: req.part, color: req.color, source: req.source, obtainedAt: now, locked: req.locked };
  if (req.color2) item.color2 = req.color2;
  if (req.days !== undefined) {
    if (!(req.days > 0 && req.days <= maxDays)) return `days must be 1-${maxDays}`;
    item.until = now + Math.round(req.days * 86400000);
    item.locked = true;
  }
  return item;
}

/** Takes an item out; the saved look loses it too. */
export function removeItem(doc: WardrobeDoc, instanceId: string): WardrobeDoc | null {
  if (!doc.items.some((it) => it.instanceId === instanceId)) return null;
  const look = doc.look ? { ...doc.look, parts: doc.look.parts.filter((p) => p.instanceId !== instanceId) } : null;
  return { items: doc.items.filter((it) => it.instanceId !== instanceId), look };
}

/** Drops expired rentals (and their worn slots). Returns null when nothing changed. */
export function pruneExpired(doc: WardrobeDoc, now: number): WardrobeDoc | null {
  const gone = doc.items.filter((it) => isExpired(it, now)).map((it) => it.instanceId);
  if (gone.length === 0) return null;
  let out: WardrobeDoc = doc;
  for (const id of gone) out = removeItem(out, id) || out;
  return out;
}

/** Plain lookup of a wardrobe doc read from storage. */
export function asWardrobeDoc(v: unknown): WardrobeDoc {
  if (!isObj(v)) return { items: [], look: null };
  return { items: Array.isArray(v.items) ? (v.items as WardrobeItem[]) : [], look: isObj(v.look) ? (v.look as unknown as StoredLook) : null };
}

/** Admin panel edit of one catalog part: only name, tier, free and active change. */
export function editPart(p: WardrobePart, input: { [k: string]: unknown }): WardrobePart | string {
  const out: WardrobePart = { ...p };
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim() === '') return 'name must be text';
    out.name = input.name.trim();
  }
  if (input.free !== undefined) {
    if (typeof input.free !== 'boolean') return 'free must be true or false';
    out.free = input.free;
  }
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') return 'active must be true or false';
    out.active = input.active;
  }
  if (input.tier !== undefined) {
    if (input.tier !== null && WEAR_TIERS.indexOf(input.tier as Tier) < 0) return `tier must be ${WEAR_TIERS.join(', ')} or null`;
    out.tier = input.tier as Tier | null;
  }
  // A free part has no Tier; a part made paid needs one.
  if (out.free) out.tier = null;
  else if (out.tier === null) return 'a part that is not free needs a tier';
  if (out.active && out.bodies.length === 0) return 'this part has no sprites for an adult body; it cannot be active';
  return out;
}
