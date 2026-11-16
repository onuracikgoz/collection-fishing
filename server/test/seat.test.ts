import { describe, expect, it } from 'vitest';
import { SEATS } from '../src/config';
import { LAKE_SEATS } from '../src/data/lake-map';
import { checkMapFile, loadMapFile, MapFile } from '../src/rules/mapFile';
import { parseSit, seatById, SitCheck, sitRefusal } from '../src/rules/seat';

const seat = { id: 'kafe_1', x: 5, y: 5, dir: 'down' as const };
const check = (over: Partial<SitCheck> = {}): SitCheck => ({
  seat,
  x: 5.5,
  y: 6,
  takenBy: undefined,
  userId: 'a',
  busy: false,
  lastAt: undefined,
  now: 10_000,
  ...over,
});

describe('parseSit', () => {
  it('reads a seat id, empty means stand up', () => {
    expect(parseSit({ seatId: 'kafe_1' })).toBe('kafe_1');
    expect(parseSit({ seatId: '' })).toBe('');
    expect(parseSit({ seatId: null })).toBe('');
    expect(parseSit({ seatId: 3 })).toBeUndefined();
    expect(parseSit(null)).toBeUndefined();
    expect(parseSit({ seatId: 'x'.repeat(65) })).toBeUndefined();
  });
});

describe('sitRefusal', () => {
  it('lets a near player sit on a free seat', () => {
    expect(sitRefusal(check(), SEATS)).toBeNull();
  });
  it('refuses a far player, a taken seat, a missing seat, a busy player and spam', () => {
    expect(sitRefusal(check({ x: 5, y: 7 }), SEATS)).toBe('TOO_FAR');
    expect(sitRefusal(check({ takenBy: 'b' }), SEATS)).toBe('TAKEN');
    expect(sitRefusal(check({ seat: undefined }), SEATS)).toBe('NOT_FOUND');
    expect(sitRefusal(check({ busy: true }), SEATS)).toBe('BUSY');
    expect(sitRefusal(check({ lastAt: 9_800 }), SEATS)).toBe('RATE_LIMITED');
  });
  it('allows sitting again on one\'s own seat', () => {
    expect(sitRefusal(check({ takenBy: 'a' }), SEATS)).toBeNull();
  });
});

describe('map seats', () => {
  const file = (seats: unknown): MapFile =>
    ({
      format: 1,
      id: 't',
      width: 4,
      height: 2,
      spawn: { x: 0.5, y: 0.5 },
      rows: ['....', '.##.'],
      points: [],
      seats,
    }) as MapFile;

  it('loads good seats', () => {
    const m = loadMapFile(file([{ id: 's', x: 1, y: 0.5, dir: 'left' }]));
    expect(seatById(m.seats, 's')).toEqual({ id: 's', x: 1, y: 0.5, dir: 'left' });
    expect(loadMapFile(file(undefined)).seats).toEqual([]);
  });
  it('catches repeated ids, bad dirs and blocked tiles', () => {
    expect(checkMapFile(file([{ id: 's', x: 1, y: 0.5, dir: 'left' }, { id: 's', x: 2, y: 0.5, dir: 'up' }]))).toContain('seat s: id repeats');
    expect(checkMapFile(file([{ id: 's', x: 1, y: 0.5, dir: 'north' }]))[0]).toMatch(/dir/);
    expect(checkMapFile(file([{ id: 's', x: 1.5, y: 1.5, dir: 'up' }]))).toContain('seat s: not on a walkable tile');
  });
  it('the lake map has the café chairs', () => {
    expect(LAKE_SEATS.length).toBeGreaterThan(0);
    expect(new Set(LAKE_SEATS.map((s) => s.id)).size).toBe(LAKE_SEATS.length);
  });
});
