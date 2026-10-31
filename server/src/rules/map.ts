// Map collision. Pure functions, no Nakama dependency.

import type { Random } from './rng';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapData {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  /** Tiles nobody can stand on (water, buildings, the fountain). */
  blocked: Rect[];
  /** Fishable water. Should also be listed in `blocked`. */
  water?: Rect[];
  /** Named waters (e.g. buyuk_gol): water tiles inside a rect take its id. */
  waterAreas?: WaterArea[];
}

export interface WaterArea extends Rect {
  id: string;
}

export interface CollisionMap {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  /** One byte per tile, row by row; 1 = blocked. */
  cells: Uint8Array;
}

export function buildCollisionMap(data: MapData): CollisionMap {
  const cells = new Uint8Array(data.width * data.height);
  for (const r of data.blocked) {
    for (let y = Math.max(0, r.y); y < Math.min(data.height, r.y + r.h); y++) {
      for (let x = Math.max(0, r.x); x < Math.min(data.width, r.x + r.w); x++) {
        cells[y * data.width + x] = 1;
      }
    }
  }
  return { width: data.width, height: data.height, spawn: data.spawn, cells };
}

export function isWalkable(map: CollisionMap, x: number, y: number): boolean {
  if (!(x >= 0 && y >= 0 && x < map.width && y < map.height)) return false;
  return map.cells[Math.floor(y) * map.width + Math.floor(x)] === 0;
}

const STEP = 0.25; // tiles between collision samples on a path

/** True if a straight walk from a to b never touches a blocked tile. */
export function isPathClear(map: CollisionMap, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable(map, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

/**
 * The walkable tile centre nearest to (x, y) that is at least minDistance away,
 * searching rings out to maxRadius, so a teleported player lands beside, not on, the target.
 */
export function spotNear(
  map: CollisionMap,
  x: number,
  y: number,
  maxRadius: number,
  minDistance: number,
): { x: number; y: number } | null {
  const min2 = minDistance * minDistance;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let r = 1; r <= maxRadius; r++) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const px = cx + dx + 0.5;
        const py = cy + dy + 0.5;
        if (!isWalkable(map, px, py)) continue;
        const d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < min2) continue;
        if (d < bestD) {
          bestD = d;
          best = { x: px, y: py };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * A random walkable tile centre inside the size x size tile square centred on (x, y): where
 * "Başlangıca dön" (GOTO_SPAWN) lands. Null when the square has no walkable tile.
 */
export function randomSpotInArea(
  map: CollisionMap,
  x: number,
  y: number,
  size: number,
  random: Random,
): { x: number; y: number } | null {
  const n = Math.max(1, Math.floor(size));
  const left = Math.floor(x) - Math.floor(n / 2);
  const top = Math.floor(y) - Math.floor(n / 2);
  const spots: { x: number; y: number }[] = [];
  for (let ty = top; ty < top + n; ty++) {
    for (let tx = left; tx < left + n; tx++) {
      if (isWalkable(map, tx + 0.5, ty + 0.5)) spots.push({ x: tx + 0.5, y: ty + 0.5 });
    }
  }
  if (spots.length === 0) return null;
  return spots[Math.min(spots.length - 1, Math.floor(random() * spots.length))];
}
