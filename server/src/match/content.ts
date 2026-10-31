// Game content in storage (docs/tasarim/19-icerik-yonetimi.md). One ContentDoc under the system
// user; item images one object each. Every Nakama VM (each match, the RPC pool) keeps its own
// compiled copy and re-reads storage at most every CHECK_MS, so an approve in the admin panel
// reaches every server within seconds; admin RPCs also signal the world matches to re-read now.
import { XP } from '../config';
import { LAKE_MAP } from '../data/lake-map';
import { seedContent } from '../data/seed-content';
import { ContentDoc, ContentRuntime, ValidateOptions, compileContent, validateContent } from '../rules/content';

export const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';
export const CONTENT_COLLECTION = 'content';
export const CONTENT_KEY = 'doc';
export const ART_COLLECTION = 'content_art';
const READ_NONE = 0 as nkruntime.ReadPermissionValues;
const WRITE_NONE = 0 as nkruntime.WritePermissionValues;
const CHECK_MS = 3000;

interface Cache {
  /** Storage object version, '' for the seed. */
  version: string;
  doc: ContentDoc;
  rt: ContentRuntime;
  checkedAt: number;
}

let cache: Cache | null = null;

/** Map waters and level cap: what validation checks drops against. */
export function contentOptions(): ValidateOptions {
  return { waters: (LAKE_MAP.waterAreas || []).map((w) => w.id), maxLevel: XP.maxLevel };
}

function seedCache(now: number): Cache {
  const doc = seedContent();
  return { version: '', doc, rt: compileContent(doc), checkedAt: now };
}

/** The stored doc and its version, or the seed with version '' when nothing is stored yet. */
export function readContentDoc(nk: nkruntime.Nakama): { doc: ContentDoc; version: string } {
  const objs = nk.storageRead([{ collection: CONTENT_COLLECTION, key: CONTENT_KEY, userId: SYSTEM_USER }]);
  if (objs.length === 0) return { doc: seedContent(), version: '' };
  return { doc: objs[0].value as unknown as ContentDoc, version: objs[0].version };
}

/**
 * The content the rules use right now. Cheap: storage is read at most every few seconds.
 * A stored doc that no longer validates is ignored (the last good one stays) and logged.
 */
export function getContent(nk: nkruntime.Nakama, logger?: nkruntime.Logger, now = Date.now()): ContentRuntime {
  if (cache && now - cache.checkedAt < CHECK_MS) return cache.rt;
  if (!cache) cache = seedCache(now);
  cache.checkedAt = now;
  try {
    const { doc, version } = readContentDoc(nk);
    if (version === cache.version) return cache.rt;
    const errors = validateContent(doc, contentOptions());
    if (errors.length > 0) {
      if (logger) logger.error('Stored content is not valid, keeping the last good one: %s', errors.slice(0, 5).join('; '));
      return cache.rt;
    }
    cache = { version, doc, rt: compileContent(doc), checkedAt: now };
  } catch (e) {
    if (logger) logger.error('Reading content failed: %s', String(e));
  }
  return cache.rt;
}

/** The next getContent re-reads storage (the admin panel just published). */
export function invalidateContent(): void {
  if (cache) cache.checkedAt = 0;
}

/** Category of anything the server knows, active or not; null for unknown ids and bait. */
export function categoryOf(rt: ContentRuntime, defId: string) {
  const k = rt.known[defId];
  return k ? k.category : null;
}

export function recipeOf(rt: ContentRuntime, id: string) {
  for (const r of rt.recipes) if (r.id === id) return r;
  return null;
}

/**
 * Saves the doc if nobody else saved since `version` was read ('' = nothing stored yet).
 * Throws on a version clash; the caller reports it and the admin reloads.
 */
export function writeContentDoc(nk: nkruntime.Nakama, doc: ContentDoc, version: string): string {
  const req: nkruntime.StorageWriteRequest = {
    collection: CONTENT_COLLECTION,
    key: CONTENT_KEY,
    userId: SYSTEM_USER,
    value: doc as unknown as { [key: string]: unknown },
    permissionRead: READ_NONE,
    permissionWrite: WRITE_NONE,
    // '*' = only if it does not exist yet.
    version: version === '' ? '*' : version,
  };
  const acks = nk.storageWrite([req]);
  invalidateContent();
  return acks[0].version;
}

export interface StoredArt {
  png: string;
  hash: string;
  w: number;
  h: number;
}

export function artWrite(id: string, art: StoredArt): nkruntime.StorageWriteRequest {
  return { collection: ART_COLLECTION, key: id, userId: SYSTEM_USER, value: art as unknown as { [key: string]: unknown }, permissionRead: READ_NONE, permissionWrite: WRITE_NONE };
}

export function readArt(nk: nkruntime.Nakama, ids: string[]): { [id: string]: StoredArt } {
  const out: { [id: string]: StoredArt } = {};
  if (ids.length === 0) return out;
  for (const o of nk.storageRead(ids.map((key) => ({ collection: ART_COLLECTION, key, userId: SYSTEM_USER })))) out[o.key] = o.value as unknown as StoredArt;
  return out;
}

/**
 * The copy this VM loaded last, without touching storage. Match code uses it; worldJoin and
 * worldLoop call getContent first, so it is at most a few seconds old.
 */
export function currentContent(): ContentRuntime {
  if (!cache) cache = seedCache(0);
  return cache.rt;
}

/** BaitConfig for the bait rules: content baits plus the config's purchase limit. */
export function baitConfig(rt: ContentRuntime, maxBuy: number) {
  return { baits: rt.baits, maxBuy };
}
