import { describe, expect, it } from 'vitest';
import { anyLocked, parseLock } from '../src/rules/lock';

describe('item lock', () => {
  it('reads a lock request and rejects bad ones', () => {
    expect(parseLock({ instanceId: 'a', locked: true })).toEqual({ instanceId: 'a', locked: true });
    expect(parseLock({ instanceId: 'a', locked: false })).toEqual({ instanceId: 'a', locked: false });
    expect(parseLock({ instanceId: 'a' })).toBeNull();
    expect(parseLock({ instanceId: '', locked: true })).toBeNull();
    expect(parseLock({ instanceId: 5, locked: true })).toBeNull();
    expect(parseLock({ instanceId: 'a', locked: 'yes' })).toBeNull();
    expect(parseLock(null)).toBeNull();
  });
  it('finds locked items', () => {
    expect(anyLocked([{}, { locked: false }])).toBe(false);
    expect(anyLocked([{}, { locked: true }])).toBe(true);
    expect(anyLocked([])).toBe(false);
  });
});
