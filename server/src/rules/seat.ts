// Sitting on chairs (docs/protokol.md "Oturma"). Pure functions.
import { MapSeat } from './mapFile';

export interface SeatConfig {
  /** How far (tiles) from the seat's point the player may stand to sit. */
  maxDistance: number;
  cooldownMs: number;
}

export type SitRefusal = 'NOT_FOUND' | 'TOO_FAR' | 'TAKEN' | 'BUSY' | 'RATE_LIMITED';

/** SIT body: the seat id, '' to stand up; undefined if the body is bad. */
export function parseSit(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const id = (body as { seatId?: unknown }).seatId;
  if (id === null || id === '') return '';
  return typeof id === 'string' && id.length <= 64 ? id : undefined;
}

export interface SitCheck {
  seat: MapSeat | undefined;
  /** Where the player stands now. */
  x: number;
  y: number;
  /** Who sits on the seat now, if anyone. */
  takenBy: string | undefined;
  userId: string;
  busy: boolean;
  lastAt: number | undefined;
  now: number;
}

/** Why the player may not sit there, or null if they may. Sitting again on one's own seat is fine. */
export function sitRefusal(c: SitCheck, cfg: SeatConfig): SitRefusal | null {
  if (c.lastAt !== undefined && c.now - c.lastAt < cfg.cooldownMs) return 'RATE_LIMITED';
  if (!c.seat) return 'NOT_FOUND';
  if (c.busy) return 'BUSY';
  if (c.takenBy !== undefined && c.takenBy !== c.userId) return 'TAKEN';
  const dx = c.x - c.seat.x;
  const dy = c.y - c.seat.y;
  if (dx * dx + dy * dy > cfg.maxDistance * cfg.maxDistance) return 'TOO_FAR';
  return null;
}

export function seatById(seats: MapSeat[], id: string): MapSeat | undefined {
  for (const s of seats) if (s.id === id) return s;
  return undefined;
}
