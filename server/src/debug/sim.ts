// Pure helpers for the developer dashboard (tools/dev-dashboard). No Nakama dependency.
// They only reuse the game rules; nothing here is used by the game itself.
import { BookPage, LuckConfig, applyLuck } from '../rules/book';
import { CatchConfig, CatchSpot, CatchTable, Category, FloatBand, ItemDef, applyBand, rollCatch, rollFloat } from '../rules/catch';
import { conditionOf } from '../rules/economy';
import { Random } from '../rules/rng';
import { FIELD, ReelParams, STEP_MS, START_PROGRESS, simulateReel } from '../rules/reel';
import { mulberry32 } from '../rules/rng';
import { Band } from '../rules/water';

export interface CatchSimResult {
  n: number;
  byCategory: { [c: string]: number };
  byDef: { [defId: string]: number };
  byCondition: { [c: string]: number };
  /** Rolls where nothing could come out (empty pool). */
  empty: number;
}

/** Rolls the catch table `n` times the way a bite does (band weights included when `catchCfg` is given), Float included. */
export function simulateCatches(
  pool: ItemDef[],
  table: CatchTable,
  spot: CatchSpot,
  hasEnergy: boolean,
  luck: number,
  luckCfg: LuckConfig,
  floatTable: FloatBand[],
  n: number,
  random: Random,
  catchCfg: CatchConfig | null = null,
): CatchSimResult {
  const lucky = applyLuck(table, luck, luckCfg);
  const boosted = catchCfg ? applyBand(lucky, spot.band, catchCfg) : lucky;
  const out: CatchSimResult = { n, byCategory: {}, byDef: {}, byCondition: {}, empty: 0 };
  for (let i = 0; i < n; i++) {
    const roll = rollCatch(pool, boosted, spot, hasEnergy, random);
    if (!roll) {
      out.empty++;
      continue;
    }
    const cat: Category = roll.def.category;
    out.byCategory[cat] = (out.byCategory[cat] || 0) + 1;
    out.byDef[roll.def.id] = (out.byDef[roll.def.id] || 0) + 1;
    if (roll.tier) {
      const c = rollFloat(floatTable, random).condition;
      out.byCondition[c] = (out.byCondition[c] || 0) + 1;
    }
  }
  return out;
}

export interface ReelSolution {
  inputs: number[];
  caught: boolean;
  /** Step the replayed game ends on; REEL_DONE must not arrive before steps × 20 ms. */
  steps: number;
}

/**
 * Plays the reel mini game like a skilled player: keeps the bar centred on the
 * fish by looking a few steps ahead. Returns inputs the server will accept.
 * `lose: true` returns inputs that let the fish escape.
 */
export function solveReel(seed: number, p: ReelParams, lose = false): ReelSolution {
  if (lose) {
    // Never pressing: the bar sinks to the bottom and progress drains, unless the fish sits there.
    const r = simulateReel(seed, p, []);
    if (!r.caught) return { inputs: [], caught: false, steps: r.steps };
    // Fish stayed low: hold the button the whole time instead.
    const held = simulateReel(seed, p, [STEP_MS]);
    return { inputs: [STEP_MS], caught: held.caught, steps: held.steps };
  }
  let best: ReelSolution | null = null;
  for (const lookahead of [4, 6, 8, 3, 10, 2, 12]) {
    const inputs = control(seed, p, lookahead);
    const r = simulateReel(seed, p, inputs);
    if (r.caught && (!best || !best.caught || r.steps < best.steps)) best = { inputs, caught: true, steps: r.steps };
    if (!best) best = { inputs, caught: r.caught, steps: r.steps };
  }
  return best!;
}

/** Runs the same model as simulateReel, choosing the button each step. */
function control(seed: number, p: ReelParams, lookahead: number): number[] {
  const rng = mulberry32(seed);
  let bar = Math.floor((FIELD - p.barSize) / 2);
  let vel = 0;
  let fish = FIELD / 2;
  let target = fish;
  let retargetLeft = 0;
  let progress = START_PROGRESS;
  let pressed = false;
  const inputs: number[] = [];
  for (let k = 1; k <= p.maxSteps; k++) {
    // Predict the bar centre a few steps ahead if nothing changes, and steer toward the fish.
    const centre = bar + p.barSize / 2 + vel * lookahead;
    const want = centre < fish;
    if (want !== pressed) {
      inputs.push(k * STEP_MS);
      pressed = want;
    }
    vel += pressed ? p.lift : -p.gravity;
    if (vel > p.maxVel) vel = p.maxVel;
    if (vel < -p.maxVel) vel = -p.maxVel;
    bar += vel;
    if (bar < 0) {
      bar = 0;
      vel = 0;
    }
    if (bar > FIELD - p.barSize) {
      bar = FIELD - p.barSize;
      vel = 0;
    }
    if (retargetLeft === 0) {
      target = rng() % (FIELD + 1);
      retargetLeft = p.retargetSteps;
    } else {
      retargetLeft--;
    }
    if (fish < target) fish = Math.min(target, fish + p.fishSpeed);
    else fish = Math.max(target, fish - p.fishSpeed);
    if (fish >= bar && fish <= bar + p.barSize) progress += p.gain;
    else progress -= p.loss;
    if (progress >= FIELD || progress <= 0) break;
  }
  return inputs;
}

/** One map row per string: '.' land, '#' blocked land, 's' / 'm' / 'd' water by band. */
export function mapRows(
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean,
  bandAt: (x: number, y: number) => Band | null,
): string[] {
  const letter: { [b in Band]: string } = { shore: 's', mid: 'm', deep: 'd' };
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const b = bandAt(x + 0.5, y + 0.5);
      row += b ? letter[b] : isBlocked(x + 0.5, y + 0.5) ? '#' : '.';
    }
    rows.push(row);
  }
  return rows;
}

/** Condition name for a Float, for the dashboard tables. */
export function conditionName(float: number, bands: FloatBand[]): string {
  return conditionOf(float, bands);
}

/** Which page a definition is on, or null. */
export function pageIdOf(pages: BookPage[], defId: string): string | null {
  for (const p of pages) if (p.items.indexOf(defId) >= 0) return p.id;
  return null;
}
