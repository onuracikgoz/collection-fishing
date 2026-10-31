import { describe, expect, it } from 'vitest';
import { LAKE_MAP } from '../src/data/lake-map';
import { buildCollisionMap, isPathClear, isWalkable, randomSpotInArea } from '../src/rules/map';
import { seededRandom } from '../src/rules/rng';

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

describe('randomSpotInArea', () => {
  it('lands on a walkable tile centre inside the 10x10 square around the spawn', () => {
    const big = buildCollisionMap({ width: 40, height: 40, spawn: { x: 20.5, y: 20.5 }, blocked: [{ x: 18, y: 15, w: 2, h: 20 }] });
    const random = seededRandom(7);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const s = randomSpotInArea(big, 20.5, 20.5, 10, random)!;
      expect(s).not.toBeNull();
      expect(s.x >= 15 && s.x < 25 && s.y >= 15 && s.y < 25).toBe(true);
      expect(s.x % 1).toBe(0.5);
      expect(isWalkable(big, s.x, s.y)).toBe(true);
      seen.add(`${s.x},${s.y}`);
    }
    // 100 tiles minus the 2x10 wall: picks spread over the square, not one fixed tile.
    expect(seen.size).toBeGreaterThan(60);
  });

  it('is null when nothing in the square is walkable', () => {
    const walled = buildCollisionMap({ width: 20, height: 20, spawn: { x: 10, y: 10 }, blocked: [{ x: 0, y: 0, w: 20, h: 20 }] });
    expect(randomSpotInArea(walled, 10, 10, 10, seededRandom(1))).toBeNull();
  });

  it('works on the real map: the spawn square has room', () => {
    const lake = buildCollisionMap(LAKE_MAP);
    expect(randomSpotInArea(lake, LAKE_MAP.spawn.x, LAKE_MAP.spawn.y, 10, seededRandom(3))).not.toBeNull();
  });
});

// The Unity map editor overwrites src/data/lake-map.ts (docs/araclar/harita-editoru.md); these hold for any map it writes.
describe('exported map shape', () => {
  it('keeps the water inside the map and blocked, and the spawn on dry land', () => {
    const lake = buildCollisionMap(LAKE_MAP);
    for (const r of LAKE_MAP.water ?? []) {
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= LAKE_MAP.width && r.y + r.h <= LAKE_MAP.height).toBe(true);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) expect(isWalkable(lake, x + 0.5, y + 0.5)).toBe(false);
    }
    expect(isWalkable(lake, LAKE_MAP.spawn.x, LAKE_MAP.spawn.y)).toBe(true);
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
