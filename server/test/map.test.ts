import { describe, expect, it } from 'vitest';
import { LAKE_MAP } from '../src/data/lake-map';
import { buildCollisionMap, isPathClear, isWalkable } from '../src/rules/map';

const map = buildCollisionMap({ width: 10, height: 10, spawn: { x: 1, y: 1 }, blocked: [{ x: 5, y: 0, w: 1, h: 10 }] });

describe('isWalkable', () => {
  it('blocks walls and the map edge', () => {
    expect(isWalkable(map, 2.5, 2.5)).toBe(true);
    expect(isWalkable(map, 5.1, 3)).toBe(false);
    expect(isWalkable(map, -0.1, 3)).toBe(false);
    expect(isWalkable(map, 10, 3)).toBe(false);
    expect(isWalkable(map, NaN, 3)).toBe(false);
  });
});

describe('isPathClear', () => {
  it('stops walking through a one-tile wall', () => {
    expect(isPathClear(map, 4.5, 3, 6.5, 3)).toBe(false);
    expect(isPathClear(map, 1, 1, 4.9, 8)).toBe(true);
  });
});

describe('first map', () => {
  it('spawns on a walkable tile and leaves the pier open', () => {
    const lake = buildCollisionMap(LAKE_MAP);
    expect(isWalkable(lake, LAKE_MAP.spawn.x, LAKE_MAP.spawn.y)).toBe(true);
    expect(isPathClear(lake, 70, 47.5, 85.5, 47.5)).toBe(true);
    expect(isWalkable(lake, 90, 40)).toBe(false);
  });
});
