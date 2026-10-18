import { describe, expect, it } from 'vitest';
import { buildCollisionMap } from '../src/rules/map';
import { applyMove, MoveIntent, newMoveState, parseMove } from '../src/rules/movement';

const cfg = { walkSpeed: 4, speedTolerance: 1.2, burstSeconds: 0.5 };
const map = buildCollisionMap({ width: 50, height: 50, spawn: { x: 10, y: 10 }, blocked: [{ x: 20, y: 0, w: 1, h: 50 }] });
const move = (seq: number, x: number, y: number): MoveIntent => ({ seq, x, y, dir: 'right', moving: true });

describe('parseMove', () => {
  it('accepts a well-formed MOVE', () => {
    expect(parseMove({ seq: 1, x: 1.5, y: 2, dir: 'up', moving: false })).toEqual({ seq: 1, x: 1.5, y: 2, dir: 'up', moving: false });
  });
  it('rejects malformed bodies', () => {
    expect(parseMove(null)).toBeNull();
    expect(parseMove({ seq: 1.5, x: 1, y: 1, dir: 'up', moving: true })).toBeNull();
    expect(parseMove({ seq: 1, x: Infinity, y: 1, dir: 'up', moving: true })).toBeNull();
    expect(parseMove({ seq: 1, x: 1, y: 1, dir: 'north', moving: true })).toBeNull();
    expect(parseMove({ seq: 1, x: 1, y: 1, dir: 'up', moving: 'yes' })).toBeNull();
  });
});

describe('applyMove', () => {
  it('accepts walking at normal speed for a long time', () => {
    let state = newMoveState(10, 10, 0, cfg);
    for (let i = 1; i <= 50; i++) {
      const res = applyMove(state, move(i, 10 + i * 0.4 * 0.2, 10), i * 100, cfg, map);
      expect(res.kind).toBe('accept');
      if (res.kind !== 'ignore') state = res.state;
    }
  });

  it('accepts MOVEs that arrive bunched in one tick', () => {
    let state = newMoveState(10, 10, 0, cfg);
    let res = applyMove(state, move(1, 10.4, 10), 1000, cfg, map);
    expect(res.kind).toBe('accept');
    if (res.kind !== 'ignore') state = res.state;
    res = applyMove(state, move(2, 10.8, 10), 1000, cfg, map);
    expect(res.kind).toBe('accept');
  });

  it('rejects walking faster than speed × tolerance for long', () => {
    let state = newMoveState(10, 10, 0, cfg);
    let rejected = false;
    for (let i = 1; i <= 20 && !rejected; i++) {
      // 6 tiles/s, limit is 4.8
      const res = applyMove(state, move(i, state.x + 0.6, 10), i * 100, cfg, map);
      if (res.kind === 'reject') rejected = true;
      if (res.kind !== 'ignore') state = res.state;
    }
    expect(rejected).toBe(true);
  });

  it('rejects a teleport and keeps the old spot', () => {
    const state = newMoveState(10, 10, 0, cfg);
    const res = applyMove(state, move(1, 18, 10), 100, cfg, map);
    expect(res.kind).toBe('reject');
    if (res.kind === 'reject') expect([res.state.x, res.state.y]).toEqual([10, 10]);
  });

  it('rejects walking through a wall or off the map', () => {
    expect(applyMove(newMoveState(19.8, 5, 0, cfg), move(1, 21.2, 5), 1000, cfg, map).kind).toBe('reject');
    expect(applyMove(newMoveState(0.2, 5, 0, cfg), move(1, -0.3, 5), 1000, cfg, map).kind).toBe('reject');
  });

  it('ignores stale or repeated seq', () => {
    const state = newMoveState(10, 10, 0, cfg);
    const res = applyMove(state, move(5, 10.2, 10), 100, cfg, map);
    expect(res.kind).toBe('accept');
    if (res.kind === 'accept') {
      expect(applyMove(res.state, move(5, 10.4, 10), 200, cfg, map).kind).toBe('ignore');
      expect(applyMove(res.state, move(3, 10.4, 10), 200, cfg, map).kind).toBe('ignore');
    }
  });

  it('does not let a long idle bank more than the burst', () => {
    const state = newMoveState(10, 10, 0, cfg);
    // 60 s standing still still only allows 4 × 1.2 × 0.5 = 2.4 tiles at once
    expect(applyMove(state, move(1, 12.3, 10), 60000, cfg, map).kind).toBe('accept');
    expect(applyMove(state, move(1, 12.5, 10), 60000, cfg, map).kind).toBe('reject');
  });
});
