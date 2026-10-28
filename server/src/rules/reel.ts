// The reel mini game (docs/protokol.md, Mini oyun modeli). Integer-only so the
// Unity client can run the exact same model and the server can replay it.
import { mulberry32 } from './rng';

export const FIELD = 1000;
export const STEP_MS = 20;
export const START_PROGRESS = 300;

export interface ReelParams {
  barSize: number;
  lift: number;
  gravity: number;
  maxVel: number;
  fishSpeed: number;
  retargetSteps: number;
  gain: number;
  loss: number;
  maxSteps: number;
  maxMs: number;
}

export interface ReelResult {
  caught: boolean;
  /** Step at which the game ended. */
  steps: number;
}

export const MAX_INPUTS = 2000;

/** Validates REEL_DONE inputs: increasing non-negative integers, not too many. */
export function parseInputs(body: unknown, maxMs: number): number[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const inputs = (body as { inputs?: unknown }).inputs;
  if (!Array.isArray(inputs) || inputs.length > MAX_INPUTS) return null;
  let last = -1;
  for (const t of inputs) {
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 0 || t <= last || t > maxMs) return null;
    last = t;
  }
  return inputs as number[];
}

/**
 * `track`, if given, counts the steps the fish spent inside the bar (bot signals,
 * rules/watch.ts). It is kept out of the result so the client port's reference
 * cases stay the same.
 */
export function simulateReel(seed: number, p: ReelParams, inputs: number[], track?: { inside: number }): ReelResult {
  const rng = mulberry32(seed);
  let bar = Math.floor((FIELD - p.barSize) / 2);
  let vel = 0;
  let fish = FIELD / 2;
  let target = fish;
  let retargetLeft = 0;
  let progress = START_PROGRESS;
  let pressed = false;
  let next = 0; // index of the next input toggle

  for (let k = 1; k <= p.maxSteps; k++) {
    const now = k * STEP_MS;
    while (next < inputs.length && inputs[next] <= now) {
      pressed = !pressed;
      next++;
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

    if (fish >= bar && fish <= bar + p.barSize) {
      progress += p.gain;
      if (track) track.inside++;
    } else progress -= p.loss;

    if (progress >= FIELD) return { caught: true, steps: k };
    if (progress <= 0) return { caught: false, steps: k };
  }
  return { caught: false, steps: p.maxSteps };
}
