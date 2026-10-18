import { describe, expect, it } from 'vitest';
import { CHAT_MAX_LENGTH, canSpeak, sanitizeChat } from '../src/rules/chat';

describe('sanitizeChat', () => {
  it('trims and collapses spaces', () => {
    expect(sanitizeChat('  selam   millet  ')).toBe('selam millet');
  });
  it('drops empty and non-string messages', () => {
    expect(sanitizeChat('   ')).toBeNull();
    expect(sanitizeChat(42)).toBeNull();
  });
  it('cuts long messages without splitting emoji', () => {
    const long = '🐟'.repeat(CHAT_MAX_LENGTH + 10);
    expect(Array.from(sanitizeChat(long)!).length).toBe(CHAT_MAX_LENGTH);
  });
});

describe('canSpeak', () => {
  it('allows the first message and blocks spam', () => {
    expect(canSpeak(undefined, 1000)).toBe(true);
    expect(canSpeak(1000, 1500)).toBe(false);
    expect(canSpeak(1000, 2000)).toBe(true);
  });
});
