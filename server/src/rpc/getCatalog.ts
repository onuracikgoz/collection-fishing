import { BAIT, CRAFT, ECONOMY, FLOAT_TABLE, ROD, STASH } from '../config';
import { LAKE_POOL } from '../data/lake-pool';
import { RECIPES } from '../data/recipes';
import { buildCatalog } from '../rules/catalog';

// Built once per module load: it only changes with the config.
let cached: string | null = null;

/** Prices, recipes, baits and stash tiers for the client's Faz 4 windows (docs/protokol.md). */
export function rpcGetCatalog(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _payload: string,
): string {
  if (!ctx.userId) throw { message: 'no user', code: 16 } as nkruntime.Error;
  if (cached === null) {
    cached = JSON.stringify(
      buildCatalog({ pool: LAKE_POOL, recipes: RECIPES, bands: FLOAT_TABLE, economy: ECONOMY, craft: CRAFT, bait: BAIT, rod: ROD, stash: STASH }),
    );
  }
  return cached;
}
