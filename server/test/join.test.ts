import { describe, expect, it } from 'vitest';
import { checkJoin, isValidUsername } from '../src/rules/join';

describe('checkJoin', () => {
  it('accepts the current protocol and defaults the character', () => {
    expect(checkJoin({ protocolVersion: '1' }, 0, 200)).toEqual({ ok: true, characterId: 'default' });
    expect(checkJoin({ protocolVersion: '1', characterId: 'lpc_m1' }, 0, 200)).toEqual({ ok: true, characterId: 'lpc_m1' });
  });
  it('rejects a wrong or missing protocol version', () => {
    expect(checkJoin({ protocolVersion: '2' }, 0, 200)).toEqual({ ok: false, error: 'PROTOCOL_MISMATCH' });
    expect(checkJoin(null, 0, 200)).toEqual({ ok: false, error: 'PROTOCOL_MISMATCH' });
  });
  it('rejects a bad character id', () => {
    expect(checkJoin({ protocolVersion: '1', characterId: '../x' }, 0, 200)).toEqual({ ok: false, error: 'BAD_REQUEST' });
  });
  it('rejects a full server', () => {
    expect(checkJoin({ protocolVersion: '1' }, 200, 200)).toEqual({ ok: false, error: 'SERVER_FULL' });
  });
});

describe('isValidUsername', () => {
  it('allows Turkish letters, digits and underscore', () => {
    expect(isValidUsername('Çağrı_42', 3, 16)).toBe(true);
  });
  it('rejects short, long, spaced or symbol names', () => {
    expect(isValidUsername('ab', 3, 16)).toBe(false);
    expect(isValidUsername('a'.repeat(17), 3, 16)).toBe(false);
    expect(isValidUsername('ali veli', 3, 16)).toBe(false);
    expect(isValidUsername('ali!', 3, 16)).toBe(false);
    expect(isValidUsername(5, 3, 16)).toBe(false);
  });
});
