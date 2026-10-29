// Where players can fish and how deep it is. Pure functions, no Nakama dependency.
import { MapData } from './map';

export type Band = 'shore' | 'mid' | 'deep';
export const BANDS: Band[] = ['shore', 'mid', 'deep'];

export interface WaterConfig {
  /** Water up to this many tiles from land is shore, then mid up to midMax, then deep. */
  shoreMax: number;
  midMax: number;
}

export interface WaterMap {
  width: number;
  height: number;
  /** Tiles from the nearest land (Chebyshev), 0 = land. */
  depth: Uint8Array;
  /** Named water per tile: index into `names` plus one, 0 = no name. */
  area: Uint8Array;
  names: string[];
  cfg: WaterConfig;
}

export function buildWaterMap(data: MapData, cfg: WaterConfig): WaterMap {
  const { width, height } = data;
  const depth = new Uint8Array(width * height);
  const queue: number[] = [];
  const isWater = new Uint8Array(width * height);
  for (const r of data.water || []) {
    for (let y = Math.max(0, r.y); y < Math.min(height, r.y + r.h); y++) {
      for (let x = Math.max(0, r.x); x < Math.min(width, r.x + r.w); x++) isWater[y * width + x] = 1;
    }
  }
  // Breadth-first from every water tile touching land (or the map edge).
  const dist = new Int32Array(width * height);
  for (let i = 0; i < dist.length; i++) dist[i] = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!isWater[i]) continue;
      let shore = false;
      for (let dy = -1; dy <= 1 && !shore; dy++) {
        for (let dx = -1; dx <= 1 && !shore; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !isWater[ny * width + nx]) shore = true;
        }
      }
      if (shore) {
        dist[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % width;
    const y = (i - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (isWater[j] && dist[j] < 0) {
          dist[j] = dist[i] + 1;
          queue.push(j);
        }
      }
    }
  }
  for (let i = 0; i < depth.length; i++) depth[i] = dist[i] > 0 ? Math.min(255, dist[i]) : 0;
  // Named waters: the first area that covers a water tile names it.
  const area = new Uint8Array(width * height);
  const names: string[] = [];
  for (const a of data.waterAreas || []) {
    if (names.length >= 255) break;
    names.push(a.id);
    const n = names.length;
    for (let y = Math.max(0, a.y); y < Math.min(height, a.y + a.h); y++) {
      for (let x = Math.max(0, a.x); x < Math.min(width, a.x + a.w); x++) {
        const i = y * width + x;
        if (isWater[i] && area[i] === 0) area[i] = n;
      }
    }
  }
  return { width, height, depth, area, names, cfg };
}

function depthAt(w: WaterMap, x: number, y: number): number {
  if (!(x >= 0 && y >= 0 && x < w.width && y < w.height)) return 0;
  return w.depth[Math.floor(y) * w.width + Math.floor(x)];
}

/** Band at a point, or null if it is not water. */
export function bandAt(w: WaterMap, x: number, y: number): Band | null {
  const d = depthAt(w, x, y);
  if (d === 0) return null;
  if (d <= w.cfg.shoreMax) return 'shore';
  if (d <= w.cfg.midMax) return 'mid';
  return 'deep';
}

/** Named water at a point (e.g. "buyuk_gol"), or null for land and unnamed water. */
export function waterAt(w: WaterMap, x: number, y: number): string | null {
  if (!(x >= 0 && y >= 0 && x < w.width && y < w.height)) return null;
  const n = w.area[Math.floor(y) * w.width + Math.floor(x)];
  return n > 0 ? w.names[n - 1] : null;
}

/** True if some water tile is within `reach` tiles of (x, y). */
export function isNearWater(w: WaterMap, x: number, y: number, reach: number): boolean {
  const x0 = Math.floor(x - reach);
  const x1 = Math.floor(x + reach);
  const y0 = Math.floor(y - reach);
  const y1 = Math.floor(y + reach);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (depthAt(w, tx, ty) === 0) continue;
      // distance from the point to the tile square
      const dx = Math.max(tx - x, 0, x - (tx + 1));
      const dy = Math.max(ty - y, 0, y - (ty + 1));
      if (dx * dx + dy * dy <= reach * reach) return true;
    }
  }
  return false;
}
