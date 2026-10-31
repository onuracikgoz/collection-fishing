// Admin panel RPCs (tools/admin, docs/araclar/admin-paneli.md). They edit the stored ContentDoc:
// items, sets, recipes, the catch table, chests and quests, and item images.
//
// Only server-to-server calls get in: the panel calls with the runtime http_key
// (`/v2/rpc/admin_*?http_key=...&unwrap`), which has no user. A game client always has a
// session and a user id, so every admin_* call from a client is refused.
import { ErrorCode, errorMessage } from '../protocol';
import {
  ContentDoc,
  ContentItem,
  ContentSet,
  ID_PATTERN,
  checkLiveChange,
  newItem,
  recipeIdFor,
  validateContent,
} from '../rules/content';
import { findWorldMatches } from '../match/servers';
import { artWrite, contentOptions, readArt, readContentDoc, writeContentDoc, ART_COLLECTION, SYSTEM_USER } from '../match/content';

type Body = { [k: string]: unknown };

/** Largest image the server keeps (decoded bytes). A 128x128 palette icon is a few KB. */
export const ART_MAX_BYTES = 96 * 1024;
const ART_MAX_SIDE = 512;
const ART_GET_MAX = 100;

const fail = (code: string, message: string, grpc = 3): nkruntime.Error => ({ message: errorMessage(code, message), code: grpc }) as nkruntime.Error;

function adminOnly(ctx: nkruntime.Context): void {
  if (ctx.userId) throw fail(ErrorCode.NOT_ALLOWED, 'admin RPCs need the server http_key, not a player session', 7);
}

function parse(payload: string): Body {
  if (!payload) return {};
  let v: unknown;
  try {
    v = JSON.parse(payload);
  } catch (_e) {
    throw fail(ErrorCode.BAD_REQUEST, 'payload is not JSON');
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw fail(ErrorCode.BAD_REQUEST, 'payload must be an object');
  return v as Body;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Reads the doc and checks the panel saw the latest version (two tabs, or two people). */
function load(nk: nkruntime.Nakama, body: Body): { doc: ContentDoc; version: string } {
  const cur = readContentDoc(nk);
  if (typeof body.version === 'string' && body.version !== cur.version) {
    throw fail('CONTENT_CHANGED', 'content changed since you loaded it; reload and try again', 9);
  }
  return { doc: clone(cur.doc), version: cur.version };
}

/** Validates and saves; every world match re-reads it right away. */
function publish(nk: nkruntime.Nakama, logger: nkruntime.Logger, doc: ContentDoc, version: string, extra: nkruntime.StorageWriteRequest[] = []): string {
  const errors = validateContent(doc, contentOptions());
  if (errors.length > 0) throw fail('CONTENT_INVALID', errors.join('\n'));
  doc.updatedAt = Date.now();
  let next: string;
  try {
    if (extra.length > 0) nk.storageWrite(extra);
    next = writeContentDoc(nk, doc, version);
  } catch (e) {
    throw fail('CONTENT_CHANGED', 'saving failed, someone else saved first: ' + String(e), 9);
  }
  const matches = findWorldMatches(nk);
  for (const id in matches) {
    try {
      nk.matchSignal(matches[id].matchId, JSON.stringify({ type: 'content_reload' }));
    } catch (e) {
      logger.warn('content_reload to %s failed: %s', id, String(e));
    }
  }
  return next;
}

function itemIndex(doc: ContentDoc, id: string): number {
  for (let i = 0; i < doc.items.length; i++) if (doc.items[i].id === id) return i;
  return -1;
}

function usedIds(doc: ContentDoc): { [id: string]: true } {
  const out: { [id: string]: true } = {};
  for (const it of doc.items) {
    out[it.id] = true;
    if (it.recipe) out[it.recipe.id] = true;
  }
  return out;
}

/** A free recipe id for a newly craftable item. */
function freeRecipeId(doc: ContentDoc, itemId: string): string {
  const used = usedIds(doc);
  const base = recipeIdFor(itemId);
  if (!used[base]) return base;
  for (let n = 2; ; n++) if (!used[`${base}_${n}`]) return `${base}_${n}`;
}

function nextOrder(doc: ContentDoc, setId: string | null): number {
  let max = -1;
  for (const it of doc.items) if (it.setId === setId && it.order > max) max = it.order;
  return max + 1;
}

/**
 * The panel's item over what is stored. The server owns: art (only admin_art_put changes it),
 * the recipe id (set once), updatedAt. Changes that would break owned copies are refused.
 */
function mergeItem(doc: ContentDoc, input: Body, now: number): ContentItem {
  if (typeof input.id !== 'string' || !ID_PATTERN.test(input.id)) throw fail(ErrorCode.BAD_REQUEST, 'item id must be 2-64 lowercase letters, digits, _ or .');
  const i = itemIndex(doc, input.id);
  const before = i >= 0 ? doc.items[i] : null;
  const base = before ? clone(before) : newItem(input.id, now);
  const it = { ...base, ...(input as Partial<ContentItem>), id: base.id, art: base.art, updatedAt: now } as ContentItem;
  if (!before && input.order === undefined) it.order = nextOrder(doc, it.setId);
  if (it.recipe) {
    const keep = before && before.recipe ? before.recipe.id : null;
    it.recipe = { ...it.recipe, id: keep || freeRecipeId(doc, it.id) };
    if (it.type === 'item') {
      delete it.recipe.count;
      delete it.recipe.dust;
    }
  }
  if (it.type !== 'bait') delete it.bait;
  if (before) {
    const errors = checkLiveChange(before, it);
    if (errors.length > 0) throw fail('CONTENT_INVALID', errors.join('\n'));
  }
  return it;
}

// --- read ---

/** Everything the panel shows: the doc, its version, problems, and what drops can choose from. */
export function rpcAdminContent(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  adminOnly(ctx);
  const { doc, version } = readContentDoc(nk);
  const opt = contentOptions();
  return JSON.stringify({ version, stored: version !== '', doc, errors: validateContent(doc, opt), waters: opt.waters, maxLevel: opt.maxLevel, artMaxBytes: ART_MAX_BYTES });
}

/** `{ ids }` → `{ art: { id: { png, hash, w, h } } }` (base64 PNG), for the panel's thumbnails. */
export function rpcAdminArtGet(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  if (!Array.isArray(body.ids) || body.ids.length > ART_GET_MAX || !body.ids.every((x) => typeof x === 'string')) {
    throw fail(ErrorCode.BAD_REQUEST, `ids must be a list of up to ${ART_GET_MAX} item ids`);
  }
  return JSON.stringify({ art: readArt(nk, body.ids as string[]) });
}

// --- write ---

/** `{ version, item }`: adds or updates one item. status live = approved (in the game now). */
export function rpcAdminItemSave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  if (typeof body.item !== 'object' || body.item === null) throw fail(ErrorCode.BAD_REQUEST, 'item is required');
  const { doc, version } = load(nk, body);
  const it = mergeItem(doc, body.item as Body, Date.now());
  const i = itemIndex(doc, it.id);
  if (i >= 0) doc.items[i] = it;
  else doc.items.push(it);
  const next = publish(nk, logger, doc, version);
  return JSON.stringify({ ok: true, version: next, item: it });
}

/** `{ version, id }`: removes a draft and its image. Live items are made inactive instead. */
export function rpcAdminItemDelete(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  const { doc, version } = load(nk, body);
  const i = typeof body.id === 'string' ? itemIndex(doc, body.id) : -1;
  if (i < 0) throw fail(ErrorCode.NOT_FOUND, 'no such item', 5);
  if (doc.items[i].status === 'live') throw fail(ErrorCode.NOT_ALLOWED, 'live items cannot be deleted (players may own copies); make it inactive', 9);
  const id = doc.items[i].id;
  const used = doc.items.filter((x) => x.recipe && (x.recipe.stacks.concat(x.recipe.items).some((s) => s.defId === id)));
  if (used.length > 0) throw fail(ErrorCode.NOT_ALLOWED, `used in the recipe of ${used.map((x) => x.id).join(', ')}`, 9);
  doc.items.splice(i, 1);
  const next = publish(nk, logger, doc, version);
  try {
    nk.storageDelete([{ collection: ART_COLLECTION, key: id, userId: SYSTEM_USER }]);
  } catch (_e) {
    // no image
  }
  return JSON.stringify({ ok: true, version: next });
}

/** `{ version, set }`: adds or updates a set. A new active set with book items is a new book page. */
export function rpcAdminSetSave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  const input = body.set as Partial<ContentSet> | undefined;
  if (!input || typeof input.id !== 'string' || !ID_PATTERN.test(input.id)) throw fail(ErrorCode.BAD_REQUEST, 'set id must be 2-64 lowercase letters, digits, _ or .');
  const { doc, version } = load(nk, body);
  const i = doc.sets.map((s) => s.id).indexOf(input.id);
  const now = Date.now();
  const base: ContentSet = i >= 0 ? doc.sets[i] : { id: input.id, name: input.id, active: true, order: doc.sets.reduce((m, s) => Math.max(m, s.order + 1), 0), createdAt: now };
  const set: ContentSet = { ...base, ...input, id: base.id, createdAt: base.createdAt };
  if (i >= 0) doc.sets[i] = set;
  else doc.sets.push(set);
  const next = publish(nk, logger, doc, version);
  return JSON.stringify({ ok: true, version: next, set });
}

/** `{ version, catchTable?, chests?, quests? }`: the general drop rates, streak chests and quest list. */
export function rpcAdminSettingsSave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  const { doc, version } = load(nk, body);
  if (body.catchTable !== undefined) doc.catchTable = body.catchTable as ContentDoc['catchTable'];
  if (body.chests !== undefined) doc.chests = body.chests as ContentDoc['chests'];
  if (body.quests !== undefined) doc.quests = body.quests as ContentDoc['quests'];
  const next = publish(nk, logger, doc, version);
  return JSON.stringify({ ok: true, version: next });
}

/** Width and height from a PNG's IHDR, or null if the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24) return null;
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
  // IHDR is the first chunk: length(4) "IHDR"(4) width(4) height(4).
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return null;
  const u32 = (o: number) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  return { w: u32(16), h: u32(20) };
}

/**
 * `{ version, id, png, setId?, tier?, type? }`: stores an item's image (base64 PNG). An unknown id
 * becomes a new draft waiting in the approval queue (the ZIP upload); `setId`, `tier` and `type`
 * only fill a new draft.
 */
export function rpcAdminArtPut(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  if (typeof body.id !== 'string' || !ID_PATTERN.test(body.id)) throw fail(ErrorCode.BAD_REQUEST, 'item id must be 2-64 lowercase letters, digits, _ or .');
  if (typeof body.png !== 'string' || body.png.length === 0) throw fail(ErrorCode.BAD_REQUEST, 'png (base64) is required');
  const png = body.png.replace(/^data:image\/png;base64,/, '');
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(nk.base64Decode(png));
  } catch (_e) {
    throw fail(ErrorCode.BAD_REQUEST, 'png is not base64');
  }
  if (bytes.length > ART_MAX_BYTES) throw fail(ErrorCode.BAD_REQUEST, `image is larger than ${ART_MAX_BYTES / 1024} KB`);
  const size = pngSize(bytes);
  if (!size) throw fail(ErrorCode.BAD_REQUEST, 'not a PNG file');
  if (size.w > ART_MAX_SIDE || size.h > ART_MAX_SIDE) throw fail(ErrorCode.BAD_REQUEST, `image is larger than ${ART_MAX_SIDE} px`);

  const { doc, version } = load(nk, body);
  const now = Date.now();
  const hash = nk.sha256Hash(png);
  let i = itemIndex(doc, body.id);
  const created = i < 0;
  if (created) {
    if (usedIds(doc)[body.id]) throw fail(ErrorCode.BAD_REQUEST, `${body.id} is a recipe id`);
    const over: Partial<ContentItem> = {};
    if (typeof body.setId === 'string' && doc.sets.some((s) => s.id === body.setId)) over.setId = body.setId;
    if (typeof body.tier === 'string') over.tier = body.tier as ContentItem['tier'];
    if (typeof body.type === 'string') over.type = body.type as ContentItem['type'];
    if (over.type && over.type !== 'item') over.tier = null;
    if (over.type === 'bait') over.bait = { price: 5, boost: {} };
    const it = newItem(body.id, now, over);
    it.order = nextOrder(doc, it.setId);
    doc.items.push(it);
    i = doc.items.length - 1;
  }
  const it = doc.items[i];
  it.art = { hash, w: size.w, h: size.h };
  it.updatedAt = now;
  const next = publish(nk, logger, doc, version, [artWrite(it.id, { png, hash, w: size.w, h: size.h })]);
  return JSON.stringify({ ok: true, version: next, item: it, created });
}

/**
 * The JSON shortcut: `{ version, items: [partial items] }` adds or fills drafts in one go, e.g. the
 * list the collection-set-generator skill writes (id, name, tier, type, setId, drop, recipe...).
 * Live items are left alone (edit them one by one); every draft still waits for approval.
 */
export function rpcAdminImport(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 500) throw fail(ErrorCode.BAD_REQUEST, 'items must be a list of 1-500 items');
  const { doc, version } = load(nk, body);
  const now = Date.now();
  const skipped: string[] = [];
  let added = 0;
  let updated = 0;
  // Sets named by the import that do not exist yet are created (inactive until approved items arrive).
  if (Array.isArray(body.sets)) {
    for (const s of body.sets as Partial<ContentSet>[]) {
      if (!s || typeof s.id !== 'string' || doc.sets.some((x) => x.id === s.id)) continue;
      doc.sets.push({ id: s.id, name: typeof s.name === 'string' ? s.name : s.id, active: true, order: doc.sets.reduce((m, x) => Math.max(m, x.order + 1), 0), createdAt: now });
    }
  }
  for (const raw of body.items as Body[]) {
    if (typeof raw !== 'object' || raw === null || typeof raw.id !== 'string') throw fail(ErrorCode.BAD_REQUEST, 'every item needs an id');
    const i = itemIndex(doc, raw.id);
    if (i >= 0 && doc.items[i].status === 'live') {
      skipped.push(raw.id);
      continue;
    }
    const it = mergeItem(doc, { ...raw, status: 'draft' }, now);
    if (it.type !== 'item') it.tier = raw.tier === undefined ? null : it.tier;
    if (i >= 0) {
      doc.items[i] = it;
      updated++;
    } else {
      doc.items.push(it);
      added++;
    }
  }
  const next = publish(nk, logger, doc, version);
  return JSON.stringify({ ok: true, version: next, added, updated, skipped });
}
