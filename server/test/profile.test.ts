import { describe, expect, it } from 'vitest';
import { BookEntries, BookPage } from '../src/rules/book';
import { checkHunting, checkShowcase, completedPages, visibleShowcase } from '../src/rules/profile';

const pages: BookPage[] = [
  { id: 'a', items: ['a1', 'a2'] },
  { id: 'b', items: ['b1'] },
];
const filled = (id: string) => ({ foundAt: 1, slot: { instanceId: id, tier: 'common' as const, float: 0.3 } });
const entries: BookEntries = { a1: filled('1'), a2: { foundAt: 1 }, b1: filled('2') };

describe('showcase', () => {
  it('accepts up to the limit of filled records', () => {
    expect(checkShowcase(entries, pages, ['a1', 'b1'], 3)).toBe(null);
    expect(checkShowcase(entries, pages, [], 3)).toBe(null);
  });
  it('refuses bad lists', () => {
    expect(checkShowcase(entries, pages, ['a1', 'b1', 'a1'], 2)).toBe('TOO_MANY');
    expect(checkShowcase(entries, pages, ['a1', 'a1'], 3)).toBe('DUPLICATE');
    expect(checkShowcase(entries, pages, ['zz'], 3)).toBe('NOT_IN_BOOK');
    expect(checkShowcase(entries, pages, ['a2'], 3)).toBe('SLOT_EMPTY');
    expect(checkShowcase(entries, pages, 'a1', 3)).toBe('BAD_REQUEST');
    expect(checkShowcase(entries, pages, [5], 3)).toBe('BAD_REQUEST');
  });
  it('hides entries whose slot was emptied', () => {
    expect(visibleShowcase({ showcase: ['a1', 'a2', 'b1'] }, entries)).toEqual(['a1', 'b1']);
  });
});

describe('hunting and pages', () => {
  it('allows any record of the book', () => {
    expect(checkHunting(pages, 'a2')).toBe(null);
    expect(checkHunting(pages, 'zz')).toBe('NOT_IN_BOOK');
    expect(checkHunting(pages, 3)).toBe('BAD_REQUEST');
  });
  it('lists pages with every record found', () => {
    expect(completedPages(entries, pages)).toEqual(['a', 'b']);
    expect(completedPages({ a1: filled('1') }, pages)).toEqual([]);
  });
});
