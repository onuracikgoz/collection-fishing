import { describe, expect, it } from 'vitest';
import { ANNOUNCE } from '../src/config';
import { shouldAnnounce } from '../src/rules/announce';

describe('rare catch announcements', () => {
  it('announces Epic and above only', () => {
    expect(shouldAnnounce('common', ANNOUNCE.minTier)).toBe(false);
    expect(shouldAnnounce('rare', ANNOUNCE.minTier)).toBe(false);
    expect(shouldAnnounce('epic', ANNOUNCE.minTier)).toBe(true);
    expect(shouldAnnounce('legendary', ANNOUNCE.minTier)).toBe(true);
    expect(shouldAnnounce('mythic', ANNOUNCE.minTier)).toBe(true);
  });
  it('follows the configured threshold', () => {
    expect(shouldAnnounce('legendary', 'mythic')).toBe(false);
    expect(shouldAnnounce('common', 'common')).toBe(true);
  });
});
