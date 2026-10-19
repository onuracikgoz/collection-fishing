import { describe, expect, it } from 'vitest';
import { BOOK_LUCK, CATCH_TABLE, SCORE } from '../src/config';
import { LAKE_POOL } from '../src/data/lake-pool';
import { BOOK_PAGES } from '../src/data/book-pages';
import { BookEntries, BookPage, SlotRef, applyLuck, discover, luckOf, onCatch, place, scoreOf, stateOf } from '../src/rules/book';
import { tierOf } from '../src/rules/catch';

const pages: BookPage[] = [
  { id: 'a', items: ['a1', 'a2', 'a3', 'a4'] },
  { id: 'b', items: ['b1', 'b2'] },
];
const slot = (instanceId: string, float: number, tier: SlotRef['tier'] = 'common'): SlotRef => ({ instanceId, tier, float });

describe('onCatch', () => {
  it('first copy is a discovery, later copies go to the bag', () => {
    expect(onCatch({}, pages, 'a1', 0.3)).toEqual({ kind: 'discovered', page: 'a', pageComplete: false });
    const e = discover({}, 'a1', slot('i1', 0.3), 1);
    expect(onCatch(e, pages, 'a1', 0.5)).toEqual({ kind: 'copy', page: 'a', better: false });
    expect(onCatch(e, pages, 'a1', 0.1)).toEqual({ kind: 'copy', page: 'a', better: true });
  });

  it('marks the last record of a page as completing it', () => {
    const e = discover({}, 'b1', slot('i1', 0.3), 1);
    expect(onCatch(e, pages, 'b2', 0.3)).toEqual({ kind: 'discovered', page: 'b', pageComplete: true });
  });

  it('items on no page are not book items', () => {
    expect(onCatch({}, pages, 'junk', 0.3)).toEqual({ kind: 'none' });
  });

  it('an empty slot makes any copy a candidate', () => {
    const e: BookEntries = { a1: { foundAt: 1 } };
    expect(onCatch(e, pages, 'a1', 0.9)).toEqual({ kind: 'copy', page: 'a', better: true });
  });
});

describe('place', () => {
  it('swaps the slot and returns the old copy', () => {
    const e = discover({}, 'a1', slot('old', 0.4), 1);
    const r = place(e, pages, 'a1', slot('new', 0.1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.previous).toEqual(slot('old', 0.4));
    expect(r.entries.a1).toEqual({ foundAt: 1, slot: slot('new', 0.1) });
    expect(e.a1.slot!.instanceId).toBe('old'); // input untouched
  });

  it('fills an empty slot of a found record', () => {
    const r = place({ a1: { foundAt: 5 } }, pages, 'a1', slot('x', 0.7));
    expect(r.ok && r.previous).toBe(null);
  });

  it('refuses items that are not recorded or not in the book', () => {
    expect(place({}, pages, 'a1', slot('x', 0.1))).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(place({}, pages, 'zz', slot('x', 0.1))).toEqual({ ok: false, reason: 'NOT_IN_BOOK' });
  });
});

describe('luck and score', () => {
  it('gives luck per page: half, then full, found records count', () => {
    let e: BookEntries = {};
    expect(luckOf(e, pages, BOOK_LUCK)).toBe(0);
    e = discover(e, 'a1', slot('1', 0.5), 1);
    expect(luckOf(e, pages, BOOK_LUCK)).toBe(0);
    e = { ...e, a2: { foundAt: 1 } }; // found but slot empty still counts
    expect(luckOf(e, pages, BOOK_LUCK)).toBeCloseTo(BOOK_LUCK.halfPage);
    e = { ...e, a3: { foundAt: 1 }, a4: { foundAt: 1 }, b1: { foundAt: 1 } };
    expect(luckOf(e, pages, BOOK_LUCK)).toBeCloseTo(BOOK_LUCK.fullPage + BOOK_LUCK.halfPage);
  });

  it('caps luck', () => {
    const many: BookPage[] = Array.from({ length: 20 }, (_, i) => ({ id: 'p' + i, items: ['x' + i] }));
    const e: BookEntries = {};
    for (let i = 0; i < 20; i++) e['x' + i] = { foundAt: 1 };
    expect(luckOf(e, many, BOOK_LUCK)).toBe(BOOK_LUCK.cap);
  });

  it('scores only filled slots, plus a bonus for a filled page', () => {
    const e: BookEntries = {
      b1: { foundAt: 1, slot: slot('1', 0.2, 'rare') },
      b2: { foundAt: 1 },
      a1: { foundAt: 1, slot: slot('2', 0.2, 'mythic') },
    };
    expect(scoreOf(e, pages, SCORE)).toBe(SCORE.tierPoints.rare + SCORE.tierPoints.mythic);
    e.b2 = { foundAt: 1, slot: slot('3', 0.2, 'epic') };
    expect(scoreOf(e, pages, SCORE)).toBe(SCORE.tierPoints.rare + SCORE.tierPoints.epic + SCORE.tierPoints.mythic + SCORE.pageFilled);
  });

  it('luck raises only rare and better categories', () => {
    const t = applyLuck(CATCH_TABLE, 0.2, BOOK_LUCK);
    expect(t.rare).toBe(Math.round(CATCH_TABLE.rare! * 1.2));
    expect(t.mythic).toBe(Math.round(CATCH_TABLE.mythic! * 1.2));
    expect(t.common).toBe(CATCH_TABLE.common);
    expect(t.junk).toBe(CATCH_TABLE.junk);
    expect(applyLuck(CATCH_TABLE, 0, BOOK_LUCK)).toBe(CATCH_TABLE);
  });

  it('reports record states', () => {
    const e: BookEntries = { a1: { foundAt: 1 }, a2: { foundAt: 1, slot: slot('1', 0.1) } };
    expect([stateOf(e, 'a1'), stateOf(e, 'a2'), stateOf(e, 'a3')]).toEqual(['found', 'filled', 'unknown']);
  });
});

describe('book data', () => {
  it('lists every Tier item of the lake once and nothing else', () => {
    const all = BOOK_PAGES.flatMap((p) => p.items);
    expect(new Set(all).size).toBe(all.length);
    const tiered = LAKE_POOL.filter((d) => tierOf(d.category)).map((d) => d.id).sort();
    expect([...all].sort()).toEqual(tiered);
  });
});
