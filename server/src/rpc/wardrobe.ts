// get_wardrobe: the player's wardrobe items and saved look (docs/protokol.md Gardırop).
import { ErrorCode, Look, errorMessage } from '../protocol';
import { WardrobeItem, currentLook, liveItems, lookView, wornMap } from '../rules/wardrobe';
import { getContent } from '../match/content';
import { readWardrobe } from '../match/wardrobe';
import { rpcLimit } from './limit';

export interface WardrobeResponse {
  items: WardrobeItem[];
  look: Look;
  /** Owned items being worn, one per slot (free parts are not listed). */
  worn: { slot: string; instanceId: string }[];
}

export function wardrobeResponse(rt: ReturnType<typeof getContent>, doc: ReturnType<typeof readWardrobe>['doc'], userId: string, now: number): WardrobeResponse {
  const w = rt.wardrobe;
  const look = currentLook(w, doc, userId, now);
  const map = wornMap(w, look);
  return { items: liveItems(doc.items, now), look: lookView(look, doc), worn: Object.keys(map).map((slot) => ({ slot, instanceId: map[slot] })) };
}

export function rpcGetWardrobe(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  rpcLimit(nk, ctx.userId, 'get_wardrobe');
  if (!ctx.userId) throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'no user'), code: 16 } as nkruntime.Error;
  const { doc } = readWardrobe(nk, ctx.userId);
  return JSON.stringify(wardrobeResponse(getContent(nk, logger), doc, ctx.userId, Date.now()));
}
