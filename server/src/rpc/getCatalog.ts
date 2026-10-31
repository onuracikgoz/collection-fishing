import { BAIT, CRAFT, ECONOMY, FLOAT_TABLE, ROD, STASH } from '../config';
import { baitConfig, getContent } from '../match/content';
import { ContentRuntime } from '../rules/content';
import { buildCatalog } from '../rules/catalog';
import { rpcLimit } from './limit';

// Built again only when the content changes (admin panel); the config is fixed per build.
let cached: { rt: ContentRuntime; json: string } | null = null;

/** Prices, recipes, baits and stash tiers for the client's Faz 4 windows (docs/protokol.md). */
export function rpcGetCatalog(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  rpcLimit(nk, ctx.userId, 'get_catalog');
  if (!ctx.userId) throw { message: 'no user', code: 16 } as nkruntime.Error;
  const rt = getContent(nk, logger);
  if (cached === null || cached.rt !== rt) {
    const json = JSON.stringify(
      buildCatalog({ pool: rt.pool, recipes: rt.recipes, bands: FLOAT_TABLE, economy: ECONOMY, craft: CRAFT, bait: baitConfig(rt, BAIT.maxBuy), rod: ROD, stash: STASH }),
    );
    cached = { rt, json };
  }
  return cached.json;
}
