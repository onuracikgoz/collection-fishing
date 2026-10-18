import { describe, expect, it } from 'vitest';
import { REEL_PARAMS } from '../src/config';
import { FIELD, ReelParams, STEP_MS, parseInputs, simulateReel } from '../src/rules/reel';
import { mulberry32 } from '../src/rules/rng';
import REFERENCE from './fixtures/reel-reference.json';

/** A simulated player who reacts `delay` steps late with some aim noise. */
function play(seed: number, p: ReelParams, delay: number, noise: number): number[] {
  const rng = mulberry32(seed);
  const shaky = mulberry32(seed ^ 0x5bd1e995);
  let bar = Math.floor((FIELD - p.barSize) / 2);
  let vel = 0;
  let fish = FIELD / 2;
  let target = fish;
  let left = 0;
  const seen: number[][] = [];
  const inputs: number[] = [];
  let pressed = false;
  for (let k = 1; k <= p.maxSteps; k++) {
    const s = seen[Math.max(0, seen.length - 1 - delay)] || [bar, vel, fish];
    const want = s[0] + p.barSize / 2 + s[1] * 8 + (shaky() / 4294967296 - 0.5) * noise < s[2];
    if (want !== pressed) {
      inputs.push(k * STEP_MS);
      pressed = want;
    }
    vel = Math.max(-p.maxVel, Math.min(p.maxVel, vel + (pressed ? p.lift : -p.gravity)));
    bar += vel;
    if (bar < 0) [bar, vel] = [0, 0];
    if (bar > FIELD - p.barSize) [bar, vel] = [FIELD - p.barSize, 0];
    if (left === 0) [target, left] = [rng() % (FIELD + 1), p.retargetSteps];
    else left--;
    fish = fish < target ? Math.min(target, fish + p.fishSpeed) : Math.max(target, fish - p.fishSpeed);
    seen.push([bar, vel, fish]);
  }
  return inputs;
}

function rate(p: ReelParams, delay: number, noise: number): number {
  let ok = 0;
  for (let s = 1; s <= 100; s++) if (simulateReel(s * 7919, p, play(s * 7919, p, delay, noise)).caught) ok++;
  return ok;
}

// Regenerate the fixture with: WRITE_REEL_FIXTURE=1 npx vitest run test/reel.test.ts
if (process.env.WRITE_REEL_FIXTURE) {
  const cases = [];
  const tiers = Object.keys(REEL_PARAMS) as (keyof typeof REEL_PARAMS)[];
  for (let i = 0; i < tiers.length; i++) {
    for (const [delay, noise] of [[5, 60], [14, 260]]) {
      const seed = (i + 1) * 104729 + delay;
      const params = REEL_PARAMS[tiers[i]];
      const inputs = play(seed, params, delay, noise);
      cases.push({ tier: tiers[i], seed, params, inputs, expected: simulateReel(seed, params, inputs) });
    }
  }
  cases.push({ tier: 'common', seed: 1, params: REEL_PARAMS.common, inputs: [], expected: simulateReel(1, REEL_PARAMS.common, []) });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fs').writeFileSync(__dirname + '/fixtures/reel-reference.json', JSON.stringify({ cases }) + '\n');
}

describe('simulateReel', () => {
  it('is deterministic for the same seed and inputs', () => {
    const inputs = play(42, REEL_PARAMS.rare, 5, 60);
    expect(simulateReel(42, REEL_PARAMS.rare, inputs)).toEqual(simulateReel(42, REEL_PARAMS.rare, inputs));
  });

  it('matches the reference cases the client port is checked against', () => {
    const r = mulberry32(1);
    expect([r(), r(), r()]).toEqual([2693262067, 11749833, 2265367787]);
    for (const c of REFERENCE.cases) {
      expect(simulateReel(c.seed, c.params, c.inputs)).toEqual(c.expected);
    }
  });

  it('a player who never presses loses', () => {
    for (const tier of Object.keys(REEL_PARAMS) as (keyof typeof REEL_PARAMS)[]) {
      expect(simulateReel(7, REEL_PARAMS[tier], []).caught).toBe(false);
    }
  });

  it('a quick player catches every tier', () => {
    for (const tier of Object.keys(REEL_PARAMS) as (keyof typeof REEL_PARAMS)[]) {
      expect(rate(REEL_PARAMS[tier], 5, 60)).toBeGreaterThanOrEqual(95);
    }
  });

  it('rarer fish are harder for a slower player', () => {
    expect(rate(REEL_PARAMS.common, 12, 200)).toBeGreaterThan(rate(REEL_PARAMS.mythic, 12, 200));
  });
});

describe('parseInputs', () => {
  it('accepts increasing integers within the time limit', () => {
    expect(parseInputs({ inputs: [0, 20, 500] }, 30000)).toEqual([0, 20, 500]);
    expect(parseInputs({ inputs: [] }, 30000)).toEqual([]);
  });
  it('rejects bad input logs', () => {
    expect(parseInputs({ inputs: [20, 20] }, 30000)).toBeNull();
    expect(parseInputs({ inputs: [5.5] }, 30000)).toBeNull();
    expect(parseInputs({ inputs: [-1] }, 30000)).toBeNull();
    expect(parseInputs({ inputs: [40000] }, 30000)).toBeNull();
    expect(parseInputs({ inputs: new Array(2001).fill(0).map((_, i) => i) }, 30000)).toBeNull();
    expect(parseInputs({}, 30000)).toBeNull();
  });
});
