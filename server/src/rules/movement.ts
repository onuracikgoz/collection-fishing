// Movement checks from docs/protokol.md. Pure functions, no Nakama dependency.
import { Dir } from '../protocol';
import { CollisionMap, isPathClear, isWalkable } from './map';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

export interface MoveIntent {
  seq: number;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
}

export interface MoveConfig {
  walkSpeed: number;
  speedTolerance: number;
  burstSeconds: number;
}

/** What the server remembers about one player's movement. */
export interface MoveState {
  x: number;
  y: number;
  /** Tiles the player may still walk right now. */
  budget: number;
  /** Server time (ms) the budget was last topped up. */
  budgetAt: number;
  lastSeq: number;
}

export function newMoveState(x: number, y: number, now: number, cfg: MoveConfig): MoveState {
  return { x, y, budget: maxBudget(cfg), budgetAt: now, lastSeq: -1 };
}

/** Parses a MOVE body. Returns null for anything malformed. */
export function parseMove(body: unknown): MoveIntent | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const { seq, x, y, dir, moving } = b;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return null;
  if (typeof x !== 'number' || !isFinite(x) || typeof y !== 'number' || !isFinite(y)) return null;
  if (typeof dir !== 'string' || DIRS.indexOf(dir as Dir) < 0) return null;
  if (typeof moving !== 'boolean') return null;
  return { seq, x, y, dir: dir as Dir, moving };
}

export type MoveResult =
  | { kind: 'ignore' } // stale seq, drop silently
  | { kind: 'accept'; state: MoveState }
  | { kind: 'reject'; state: MoveState }; // send CORRECTION with state.x/y

const EPSILON = 1e-6;

export function maxBudget(cfg: MoveConfig): number {
  return cfg.walkSpeed * cfg.speedTolerance * cfg.burstSeconds;
}

/**
 * Checks one MOVE against speed, map bounds and collision.
 * Speed is a walking budget that refills at walkSpeed × tolerance per second,
 * so MOVEs that arrive bunched up by the network are not punished.
 */
export function applyMove(
  state: MoveState,
  intent: MoveIntent,
  now: number,
  cfg: MoveConfig,
  map: CollisionMap,
): MoveResult {
  if (intent.seq <= state.lastSeq) return { kind: 'ignore' };

  const elapsed = Math.max(0, now - state.budgetAt) / 1000;
  const budget = Math.min(maxBudget(cfg), state.budget + elapsed * cfg.walkSpeed * cfg.speedTolerance);
  const refilled: MoveState = { ...state, budget, budgetAt: now, lastSeq: intent.seq };

  const dist = Math.hypot(intent.x - state.x, intent.y - state.y);
  const ok =
    dist <= budget + EPSILON &&
    isWalkable(map, intent.x, intent.y) &&
    isPathClear(map, state.x, state.y, intent.x, intent.y);

  if (!ok) return { kind: 'reject', state: refilled };
  return { kind: 'accept', state: { ...refilled, x: intent.x, y: intent.y, budget: Math.max(0, budget - dist) } };
}
