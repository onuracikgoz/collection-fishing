import { describe, expect, it } from 'vitest';
import { TRANSFER } from '../src/config';
import { CODE_ALPHABET, formatCode, generateCode, isLive, normalizeCode, parseRedeem, recent, underLimit } from '../src/rules/transfer';

describe('transfer code', () => {
  it('uses 32 readable characters', () => {
    expect(CODE_ALPHABET.length).toBe(32);
    for (const bad of ['I', 'O', '0', '1']) expect(CODE_ALPHABET).not.toContain(bad);
  });
  it('builds a code of the set length from random bytes', () => {
    const code = generateCode([0, 1, 31, 32, 255, 100, 7, 8], 8);
    expect(code).toBe('AB9A9EHJ');
    expect(code.length).toBe(8);
    for (const c of code) expect(CODE_ALPHABET).toContain(c);
  });
  it('reads what the player types', () => {
    expect(normalizeCode('abcd-efgh', 8)).toBe('ABCDEFGH');
    expect(normalizeCode(' ABCD EFGH ', 8)).toBe('ABCDEFGH');
    expect(normalizeCode('ABCDEFG', 8)).toBeNull();
    expect(normalizeCode('ABCDEFGO', 8)).toBeNull();
    expect(normalizeCode('ABCDEFG1', 8)).toBeNull();
    expect(normalizeCode(12345678, 8)).toBeNull();
    expect(formatCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });
  it('knows if a record is still good', () => {
    expect(isLive({ owner: 'u', expiresAt: 100 }, 99)).toBe(true);
    expect(isLive({ owner: 'u', expiresAt: 100 }, 100)).toBe(false);
    expect(isLive({ owner: 5, expiresAt: 100 }, 1)).toBe(false);
    expect(isLive(null, 1)).toBe(false);
  });
  it('limits events per window', () => {
    const times = [0, 1000, 2000];
    expect(underLimit(times, 3000, 10000, 4)).toBe(true);
    expect(underLimit(times, 3000, 10000, 3)).toBe(false);
    expect(underLimit(times, 20000, 10000, 3)).toBe(true);
    expect(recent(times, 10500, 10000)).toEqual([1000, 2000]);
  });
  it('parses the redeem payload', () => {
    expect(parseRedeem(JSON.stringify({ code: 'abcd-efgh', steamToken: 't' }), TRANSFER.codeLength)).toEqual({ code: 'ABCDEFGH', steamToken: 't' });
    expect(parseRedeem(JSON.stringify({ code: 'abcd-efgh' }), 8)).toBeNull();
    expect(parseRedeem(JSON.stringify({ code: 'x', steamToken: 't' }), 8)).toBeNull();
    expect(parseRedeem('not json', 8)).toBeNull();
    expect(parseRedeem('', 8)).toBeNull();
  });
});
