// Reads a map file (content/maps/*.json, docs/protokol.md "Harita dosyası") into MapData.
// Pure functions, no Nakama dependency.
import { MapData, Rect, WaterArea } from './map';

export const MAP_FORMAT = 1;

export const POINT_KINDS = ['bank', 'craftsman', 'shop', 'board', 'rest'] as const;
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
  /**
   * Named waters, optional. Water tiles inside a rect belong to that water
   * (items' `waters` field). When given, every water tile must be in exactly one.
   */
  waters?: WaterArea[];
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
  errors.push(...checkWaters(file));
  return errors;
}

const WATER_ID = /^[a-z0-9_]{1,32}$/;

/** Named waters: valid ids and rects, and every water tile named exactly once. */
function checkWaters(file: MapFile): string[] {
  if (file.waters === undefined) return [];
  if (!Array.isArray(file.waters)) return ['waters must be a list'];
  if (file.waters.length === 0) return [];
  if (file.waters.length > 255) return ['waters: at most 255'];
  const errors: string[] = [];
  const { width, height, rows } = file;
  const owner: (string | null)[] = new Array(width * height).fill(null);
  const seen: Record<string, true> = {};
  for (const a of file.waters) {
    const name = a && typeof a.id === 'string' ? a.id : '?';
    if (!a || typeof a.id !== 'string' || !WATER_ID.test(a.id)) {
      errors.push(`water ${name}: id must be lowercase letters, digits or _`);
      continue;
    }
    if (seen[a.id]) {
      errors.push(`water ${a.id}: id repeats`);
      continue;
    }
    seen[a.id] = true;
    const ints = [a.x, a.y, a.w, a.h].every((v) => Number.isInteger(v));
    if (!ints || a.w <= 0 || a.h <= 0 || a.x < 0 || a.y < 0 || a.x + a.w > width || a.y + a.h > height) {
      errors.push(`water ${a.id}: rect must be whole tiles inside the map`);
      continue;
    }
    let tiles = 0;
    for (let y = a.y; y < a.y + a.h; y++) {
      for (let x = a.x; x < a.x + a.w; x++) {
        if (rows[y][x] !== WATER) continue;
        tiles++;
        const i = y * width + x;
        if (owner[i] !== null) errors.push(`water ${a.id}: overlaps ${owner[i]} at ${x},${y}`);
        else owner[i] = a.id;
      }
    }
    if (tiles === 0) errors.push(`water ${a.id}: no water tile inside`);
  }
  if (errors.length) return errors.slice(0, 10);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] === WATER && owner[y * width + x] === null) return [`water tile ${x},${y} has no name`];
    }
  }
  return [];
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
      waterAreas: (file.waters || []).map((a) => ({ id: a.id, x: a.x, y: a.y, w: a.w, h: a.h })),
    },
    points: file.points.map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: p.y })),
  };
}

export function pointById(map: LoadedMap, id: string): MapPoint {
  for (const p of map.points) if (p.id === id) return p;
  throw new Error(`map ${map.id}: no point ${id}`);
}
