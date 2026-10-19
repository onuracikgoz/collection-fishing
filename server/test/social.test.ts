import { describe, expect, it } from 'vitest';
import { EMOTES } from '../src/config';
import { LAKE_MAP } from '../src/data/lake-map';
import { canEmote, parseEmote } from '../src/rules/emote';
import { buildCollisionMap, isWalkable, spotNear } from '../src/rules/map';

describe('spotNear', () => {
  const map = buildCollisionMap({ width: 10, height: 10, spawn: { x: 1, y: 1 }, blocked: [{ x: 4, y: 0, w: 1, h: 10 }] });

  it('lands on a free tile next to the target', () => {
    const s = spotNear(map, 2.5, 2.5, 3)!;
    expect(isWalkable(map, s.x, s.y)).toBe(true);
    expect(Math.max(Math.abs(s.x - 2.5), Math.abs(s.y - 2.5))).toBe(1);
  });

  it('skips blocked tiles', () => {
    const s = spotNear(map, 3.9, 5.5, 3)!;
    expect(isWalkable(map, s.x, s.y)).toBe(true);
    expect(Math.floor(s.x)).not.toBe(4);
  });

  it('gives up when nothing is free', () => {
    const wall = buildCollisionMap({ width: 3, height: 3, spawn: { x: 1, y: 1 }, blocked: [{ x: 0, y: 0, w: 3, h: 3 }] });
    expect(spotNear(wall, 1.5, 1.5, 2)).toBe(null);
  });

  it('finds a spot beside a player at the pier end', () => {
    const lake = buildCollisionMap(LAKE_MAP);
    const s = spotNear(lake, 85.4, 47.5, 4)!;
    expect(isWalkable(lake, s.x, s.y)).toBe(true);
  });
});

describe('emotes', () => {
  it('accepts only listed emotes', () => {
    expect(parseEmote({ emote: 'wave' }, EMOTES)).toBe('wave');
    expect(parseEmote({ emote: 'kiss' }, EMOTES)).toBe(null);
    expect(parseEmote({}, EMOTES)).toBe(null);
    expect(parseEmote(null, EMOTES)).toBe(null);
  });
  it('has a cooldown', () => {
    expect(canEmote(undefined, 0, EMOTES)).toBe(true);
    expect(canEmote(1000, 1000 + EMOTES.cooldownMs - 1, EMOTES)).toBe(false);
    expect(canEmote(1000, 1000 + EMOTES.cooldownMs, EMOTES)).toBe(true);
  });
});
