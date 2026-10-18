// Who sees and hears whom. Pure functions, no Nakama dependency.

export interface Point {
  id: string;
  x: number;
  y: number;
}

/** Buckets players into square cells so lookups only scan nearby cells. */
export class SpatialGrid {
  private cells: { [key: string]: Point[] } = {};

  constructor(private cellSize: number, points: Point[]) {
    for (const p of points) {
      const key = this.key(Math.floor(p.x / cellSize), Math.floor(p.y / cellSize));
      (this.cells[key] = this.cells[key] || []).push(p);
    }
  }

  /** Points within radius of (x, y), including one standing exactly there. */
  near(x: number, y: number, radius: number): Point[] {
    const out: Point[] = [];
    const r2 = radius * radius;
    const x0 = Math.floor((x - radius) / this.cellSize);
    const x1 = Math.floor((x + radius) / this.cellSize);
    const y0 = Math.floor((y - radius) / this.cellSize);
    const y1 = Math.floor((y + radius) / this.cellSize);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[this.key(cx, cy)];
        if (!cell) continue;
        for (const p of cell) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy <= r2) out.push(p);
        }
      }
    }
    return out;
  }

  private key(cx: number, cy: number): string {
    return cx + ',' + cy;
  }
}

export interface VisibilityChange {
  visible: { [id: string]: true };
  entered: string[];
  left: string[];
}

/**
 * Works out who `self` sees this tick. Others enter inside enterRadius and
 * leave only past leaveRadius, so someone pacing on the edge does not flicker.
 */
export function updateVisibility(
  self: Point,
  prev: { [id: string]: true },
  grid: SpatialGrid,
  enterRadius: number,
  leaveRadius: number,
): VisibilityChange {
  const visible: { [id: string]: true } = {};
  const entered: string[] = [];
  const left: string[] = [];
  const inLeave: { [id: string]: true } = {};
  for (const p of grid.near(self.x, self.y, leaveRadius)) {
    if (p.id === self.id) continue;
    inLeave[p.id] = true;
    const dist2 = (p.x - self.x) * (p.x - self.x) + (p.y - self.y) * (p.y - self.y);
    if (prev[p.id]) {
      visible[p.id] = true;
    } else if (dist2 <= enterRadius * enterRadius) {
      visible[p.id] = true;
      entered.push(p.id);
    }
  }
  for (const id in prev) {
    if (!inLeave[id]) left.push(id);
  }
  return { visible, entered, left };
}
