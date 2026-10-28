// Band balance (03-balik-tutma.md "Bantların dengesi"): a good player should not
// always cast deep. Plays many casts per band with the real config: wait, reel
// (skilled solver plus a miss chance that grows with Tier and depth), catch table.
import { describe, expect, it } from 'vitest';
import { CATCH, CATCH_TABLE, ECONOMY, FISHING, REEL_PARAMS } from '../src/config';
import { LAKE_POOL } from '../src/data/lake-pool';
import { solveReel } from '../src/debug/sim';
import { Tier, applyBand, rollCatch } from '../src/rules/catch';
import { reelParamsFor } from '../src/rules/fishing';
import { seededRandom } from '../src/rules/rng';
import { Band } from '../src/rules/water';

const MISS: { [t in Tier]: number } = { common: 0.03, rare: 0.06, epic: 0.12, legendary: 0.2, mythic: 0.3 };
const DEPTH_MISS: { [b in Band]: number } = { shore: 0.7, mid: 1, deep: 1.5 };
const HOOK_MS = 1500;

function hour(band: Band, casts: number) {
  const random = seededRandom(1);
  const table = applyBand(CATCH_TABLE, band, CATCH);
  let coin = 0;
  let materials = 0;
  let high = 0;
  let ms = 0;
  for (let i = 0; i < casts; i++) {
    const roll = rollCatch(LAKE_POOL, table, { band, water: 'buyuk_gol', level: 1 }, true, random)!;
    const { minMs, maxMs } = FISHING.wait[band];
    ms += minMs + random() * (maxMs - minMs) + HOOK_MS;
    const tier = roll.tier || 'common';
    const sol = solveReel(Math.floor(random() * 4294967296), reelParamsFor(REEL_PARAMS[tier], band, FISHING));
    ms += sol.steps * 20;
    if (!sol.caught || random() < MISS[tier] * DEPTH_MISS[band]) continue;
    coin += ECONOMY.sellPrice[roll.def.category] || 0;
    if (roll.def.category === 'material') materials++;
    if (roll.tier === 'epic' || roll.tier === 'legendary' || roll.tier === 'mythic') high++;
  }
  const h = ms / 3600000;
  return { coin: coin / h, materials: materials / h, high: high / h, casts: casts / h };
}

describe('band balance per hour', () => {
  const shore = hour('shore', 10000);
  const deep = hour('deep', 10000);

  it('coin per hour stays close between shore and deep', () => {
    expect(shore.coin / deep.coin).toBeGreaterThan(0.7);
    expect(shore.coin / deep.coin).toBeLessThan(1.3);
  });

  it('the shore gives more catches and several times the materials', () => {
    expect(shore.casts).toBeGreaterThan(deep.casts * 1.4);
    expect(shore.materials).toBeGreaterThan(deep.materials * 4);
  });

  it('deep water gives high Tiers more often', () => {
    expect(deep.high).toBeGreaterThan(shore.high * 1.4);
  });
});
