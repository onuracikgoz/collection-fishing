import { describe, expect, it } from 'vitest';
import { STASH, WATER } from '../src/config';
import { BANK_POINT, LAKE, LAKE_MAP } from '../src/data/lake-map';
import { buildCollisionMap, isWalkable } from '../src/rules/map';
import { checkMapFile, loadMapFile, MapFile, pointById } from '../src/rules/mapFile';
import { bandAt, buildWaterMap } from '../src/rules/water';

function file(over: Partial<MapFile> = {}): MapFile {
  return {
    format: 1,
    id: 'test',
    width: 6,
    height: 4,
    spawn: { x: 0.5, y: 0.5 },
    rows: ['......', '.##.~~', '....~~', '....~~'],
    points: [{ id: 'bank', kind: 'bank', x: 1.5, y: 3.5 }],
    ...over,
  };
}

describe('checkMapFile', () => {
  it('accepts a good file', () => {
    expect(checkMapFile(file(), ['bank'])).toEqual([]);
  });

  it('catches wrong sizes and unknown characters', () => {
    expect(checkMapFile(file({ rows: ['......', '......', '......'] }))[0]).toMatch(/rows: expected 4/);
    expect(checkMapFile(file({ rows: ['......', '.....', '......', '......'] }))[0]).toMatch(/row 1/);
    expect(checkMapFile(file({ rows: ['......', '..x...', '......', '......'] }))[0]).toMatch(/unknown character 'x'/);
    expect(checkMapFile(file({ format: 2 }))[0]).toMatch(/format/);
  });

  it('wants spawn and points on walkable tiles', () => {
    expect(checkMapFile(file({ spawn: { x: 1.5, y: 1.5 } }))).toContain('spawn is not on a walkable tile');
    expect(checkMapFile(file({ points: [{ id: 'bank', kind: 'bank', x: 4.5, y: 2.5 }] }))).toContain(
      'point bank: not on a walkable tile',
    );
    expect(checkMapFile(file({ points: [{ id: 'bank', kind: 'bank', x: 9, y: 1 }] }))).toContain(
      'point bank: not on a walkable tile',
    );
  });

  it('catches repeated ids, unknown kinds and missing required points', () => {
    const p = { id: 'a', kind: 'rest' as const, x: 0.5, y: 2.5 };
    expect(checkMapFile(file({ points: [p, p] }))).toContain('point a: id repeats');
    expect(checkMapFile(file({ points: [{ ...p, kind: 'disco' as never }] }))).toContain('point a: unknown kind');
    expect(checkMapFile(file({ points: [p] }), ['bank'])).toContain('point bank is required');
  });
});

describe('loadMapFile', () => {
  it('turns rows into blocked and water rectangles', () => {
    const m = loadMapFile(file());
    expect(m.data.water).toEqual([
      { x: 4, y: 1, w: 2, h: 1 },
      { x: 4, y: 2, w: 2, h: 1 },
      { x: 4, y: 3, w: 2, h: 1 },
    ]);
    const c = buildCollisionMap(m.data);
    expect(isWalkable(c, 0.5, 1.5)).toBe(true);
    expect(isWalkable(c, 1.5, 1.5)).toBe(false); // '#'
    expect(isWalkable(c, 2.9, 1.5)).toBe(false); // '#'
    expect(isWalkable(c, 4.5, 2.5)).toBe(false); // water
    expect(pointById(m, 'bank')).toEqual({ id: 'bank', kind: 'bank', x: 1.5, y: 3.5 });
  });

  it('throws with every problem listed', () => {
    expect(() => loadMapFile(file({ spawn: { x: 1.5, y: 1.5 } }), ['shop'])).toThrow(
      /spawn is not on a walkable tile; point shop is required/,
    );
  });
});

describe('content/maps/lake.json', () => {
  it('loads and keeps the first map as it was', () => {
    expect(LAKE.id).toBe('lake');
    expect(LAKE_MAP.width).toBe(128);
    expect(LAKE_MAP.height).toBe(96);
    const c = buildCollisionMap(LAKE_MAP);
    expect(isWalkable(c, 64, 48)).toBe(false); // fountain
    expect(isWalkable(c, 80, 47.5)).toBe(true); // pier
    expect(isWalkable(c, 90, 47.5)).toBe(false); // water past the pier
    const w = buildWaterMap(LAKE_MAP, WATER);
    expect(bandAt(w, 76.5, 35.5)).toBe('shore');
    expect(bandAt(w, 100.5, 40.5)).toBe('deep');
  });

  it('puts the bank where the stash checks for it', () => {
    expect(STASH.bank).toEqual({ x: BANK_POINT.x, y: BANK_POINT.y });
    expect(isWalkable(buildCollisionMap(LAKE_MAP), BANK_POINT.x, BANK_POINT.y)).toBe(true);
  });
});
