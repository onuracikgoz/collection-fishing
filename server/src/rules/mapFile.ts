// Reads a map file (content/maps/*.json, docs/protokol.md "Harita dosyası") into MapData.
// Pure functions, no Nakama dependency.
import { MapData, Rect } from './map';

export const MAP_FORMAT = 1;

export const POINT_KINDS = ['bank', 'craftsman', 'shop', 'board', 'rest', 'market'] as const;
export type PointKind = (typeof POINT_KINDS)[number];

export interface MapPoint {
  id: string;
  kind: PointKind;
  x: number;
  y: number;
}

export interface MapFile {
  format: number;
  id: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  /** One string per row, one character per tile: '.' walkable, '#' blocked, '~' water. */
  rows: string[];
  points: MapPoint[];
}

export interface LoadedMap {
  id: string;
  data: MapData;
  points: MapPoint[];
}

const WALK = '.';
const BLOCK = '#';
const WATER = '~';

function isPos(p: unknown): p is { x: number; y: number } {
  const o = p as { x?: unknown; y?: unknown } | null;
  return !!o && typeof o.x === 'number' && typeof o.y === 'number' && isFinite(o.x) && isFinite(o.y);
}

/** Every problem with the file, empty if it is usable. `required` lists point ids the server needs. */
export function checkMapFile(file: MapFile, required: string[] = []): string[] {
  const errors: string[] = [];
  if (!file || typeof file !== 'object') return ['not an object'];
  if (file.format !== MAP_FORMAT) errors.push(`format ${file.format} is not ${MAP_FORMAT}`);
  if (typeof file.id !== 'string' || !file.id) errors.push('id missing');
  const { width, height } = file;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    errors.push('width and height must be positive integers');
    return errors;
  }
  if (!Array.isArray(file.rows) || file.rows.length !== height) {
    errors.push(`rows: expected ${height}, got ${Array.isArray(file.rows) ? file.rows.length : 'none'}`);
    return errors;
  }
  file.rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== width) {
      errors.push(`row ${y}: expected ${width} characters`);
      return;
    }
    const bad = row.split('').findIndex((c) => c !== WALK && c !== BLOCK && c !== WATER);
    if (bad >= 0) errors.push(`row ${y}: unknown character '${row[bad]}' at x ${bad}`);
  });
  if (errors.length) return errors;

  const walkable = (p: { x: number; y: number }) =>
    p.x >= 0 && p.y >= 0 && p.x < width && p.y < height && file.rows[Math.floor(p.y)][Math.floor(p.x)] === WALK;

  if (!isPos(file.spawn)) errors.push('spawn missing');
  else if (!walkable(file.spawn)) errors.push('spawn is not on a walkable tile');

  const points = Array.isArray(file.points) ? file.points : [];
  if (!Array.isArray(file.points)) errors.push('points missing');
  const seen: Record<string, true> = {};
  for (const p of points) {
    const name = p && typeof p.id === 'string' ? p.id : '?';
    if (!p || typeof p.id !== 'string' || !p.id) errors.push('point without id');
    else if (seen[p.id]) errors.push(`point ${p.id}: id repeats`);
    else seen[p.id] = true;
    if (!p || (POINT_KINDS as readonly string[]).indexOf(p.kind) < 0) errors.push(`point ${name}: unknown kind`);
    if (!isPos(p)) errors.push(`point ${name}: x / y missing`);
    else if (!walkable(p)) errors.push(`point ${name}: not on a walkable tile`);
  }
  for (const id of required) if (!seen[id]) errors.push(`point ${id} is required`);
  return errors;
}

/** Joins runs of the same character in a row into 1-tile-high rectangles. */
function runs(rows: string[], ch: string): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== ch) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === ch) x++;
      out.push({ x: start, y, w: x - start, h: 1 });
    }
  });
  return out;
}

/** Checks the file and turns it into the collision data the rules use. Throws if the file is broken. */
export function loadMapFile(file: MapFile, required: string[] = []): LoadedMap {
  const errors = checkMapFile(file, required);
  if (errors.length) throw new Error(`map ${file && file.id}: ${errors.join('; ')}`);
  const water = runs(file.rows, WATER);
  return {
    id: file.id,
    data: {
      width: file.width,
      height: file.height,
      spawn: { x: file.spawn.x, y: file.spawn.y },
      blocked: runs(file.rows, BLOCK).concat(water),
      water,
    },
    points: file.points.map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: p.y })),
  };
}

export function pointById(map: LoadedMap, id: string): MapPoint {
  for (const p of map.points) if (p.id === id) return p;
  throw new Error(`map ${map.id}: no point ${id}`);
}
