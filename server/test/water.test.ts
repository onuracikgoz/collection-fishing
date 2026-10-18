import { describe, expect, it } from 'vitest';
import { WATER } from '../src/config';
import { LAKE_MAP } from '../src/data/lake-map';
import { bandAt, buildWaterMap, isNearWater } from '../src/rules/water';

const small = buildWaterMap({ width: 20, height: 20, spawn: { x: 0, y: 0 }, blocked: [], water: [{ x: 5, y: 5, w: 13, h: 13 }] }, { shoreMax: 2, midMax: 5 });

describe('bandAt', () => {
  it('gets deeper away from land', () => {
    expect(bandAt(small, 2, 2)).toBeNull();
    expect(bandAt(small, 5.5, 11)).toBe('shore');
    expect(bandAt(small, 6.5, 11)).toBe('shore');
    expect(bandAt(small, 7.5, 11)).toBe('mid');
    expect(bandAt(small, 11.5, 11.5)).toBe('deep');
  });
});

describe('isNearWater', () => {
  it('needs water within reach', () => {
    expect(isNearWater(small, 4.5, 10, 1.5)).toBe(true);
    expect(isNearWater(small, 2, 10, 1.5)).toBe(false);
  });
});

describe('first map', () => {
  const lake = buildWaterMap(LAKE_MAP, WATER);
  it('has fishable water next to the pier and deep water in the middle', () => {
    expect(isNearWater(lake, 84.5, 47.5, 1.5)).toBe(true);
    expect(bandAt(lake, 86.5, 47.5)).toBe('shore');
    expect(bandAt(lake, 95.5, 48)).toBe('deep');
    expect(isNearWater(lake, LAKE_MAP.spawn.x, LAKE_MAP.spawn.y, 1.5)).toBe(false);
  });
  it('does not count the fountain as water', () => {
    expect(bandAt(lake, 64, 48)).toBeNull();
  });
});
