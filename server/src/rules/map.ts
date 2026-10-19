// Map collision. Pure functions, no Nakama dependency.

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
 * The walkable tile centre nearest to (x, y), searching rings out to maxRadius.
 * Skips the tile itself so a teleported player lands beside, not on, the target.
 */
export function spotNear(map: CollisionMap, x: number, y: number, maxRadius: number): { x: number; y: number } | null {
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
