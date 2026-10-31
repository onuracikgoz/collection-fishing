// get_content and get_item_art: names, Tiers, sets and images of every item, for the client
// (docs/protokol.md, İçerik). The admin panel adds items at run time, so the client cannot
// carry this list in its build; it asks once at login and again when `updatedAt` changes.
import { getContent, readArt } from '../match/content';
import { ErrorCode, errorMessage } from '../protocol';
import { ContentRuntime } from '../rules/content';
import { rpcLimit } from './limit';

/** Arrays and strings only, so Unity's JsonUtility can read it ('' instead of null). */
export interface ContentResponse {
  updatedAt: number;
  items: { id: string; name: string; type: string; tier: string; setId: string; active: boolean; art: string }[];
  sets: { id: string; name: string; active: boolean }[];
  /** Ids of the sets that are book pages right now (active sets with active book items). */
  pages: string[];
}

export function contentResponse(rt: ContentRuntime): ContentResponse {
  const items: ContentResponse['items'] = [];
  for (const id in rt.known) {
    const k = rt.known[id];
    items.push({ id, name: k.name, type: k.type, tier: k.tier || '', setId: k.setId || '', active: k.active, art: k.art ? k.art.hash : '' });
  }
  return { updatedAt: rt.updatedAt, items, sets: rt.sets.map((s) => ({ ...s })), pages: rt.pages.map((p) => p.id) };
}

let cached: { rt: ContentRuntime; json: string } | null = null;

export function rpcGetContent(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  rpcLimit(nk, ctx.userId, 'get_content');
  if (!ctx.userId) throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'no user'), code: 16 } as nkruntime.Error;
  const rt = getContent(nk, logger);
  if (!cached || cached.rt !== rt) cached = { rt, json: JSON.stringify(contentResponse(rt)) };
  return cached.json;
}

export const ART_PER_CALL = 40;

/** `{ ids }` (up to 40) → `{ art: [{ id, hash, png }] }`, png as base64. Unknown ids and drafts are left out. */
export function rpcGetItemArt(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  rpcLimit(nk, ctx.userId, 'get_item_art');
  if (!ctx.userId) throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'no user'), code: 16 } as nkruntime.Error;
  let ids: unknown;
  try {
    ids = (JSON.parse(payload || '{}') as { ids?: unknown }).ids;
  } catch (_e) {
    ids = null;
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > ART_PER_CALL || !ids.every((x) => typeof x === 'string')) {
    throw { message: errorMessage(ErrorCode.BAD_REQUEST, `ids must be a list of 1-${ART_PER_CALL} item ids`), code: 3 } as nkruntime.Error;
  }
  const rt = getContent(nk, logger);
  const wanted = (ids as string[]).filter((id, i, a) => a.indexOf(id) === i && rt.known[id] && rt.known[id].art);
  const stored = readArt(nk, wanted);
  const art = wanted.filter((id) => stored[id]).map((id) => ({ id, hash: stored[id].hash, png: stored[id].png }));
  return JSON.stringify({ art });
}
