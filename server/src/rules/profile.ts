// Profile card and showcase (docs/tasarim/10-sosyal.md 13.3, 13.4). Pure functions.
import { BookEntries, BookPage, pageOf } from './book';

export interface ProfileDoc {
  /** Book records shown on the card; each must have an item in its slot. */
  showcase: string[];
  /** "Arıyorum": a book record the player is looking for. */
  hunting?: string;
}

export type ProfileError = 'TOO_MANY' | 'DUPLICATE' | 'NOT_IN_BOOK' | 'SLOT_EMPTY' | 'BAD_REQUEST';

/** Showcase entries must be distinct records with a filled slot. */
export function checkShowcase(entries: BookEntries, pages: BookPage[], ids: unknown, max: number): ProfileError | null {
  if (!Array.isArray(ids)) return 'BAD_REQUEST';
  if (ids.length > max) return 'TOO_MANY';
  const seen: { [id: string]: true } = {};
  for (const id of ids) {
    if (typeof id !== 'string') return 'BAD_REQUEST';
    if (seen[id]) return 'DUPLICATE';
    seen[id] = true;
    if (!pageOf(pages, id)) return 'NOT_IN_BOOK';
    if (!entries[id] || !entries[id].slot) return 'SLOT_EMPTY';
  }
  return null;
}

/** Any record on a book page can be hunted, found or not. */
export function checkHunting(pages: BookPage[], id: unknown): ProfileError | null {
  if (typeof id !== 'string') return 'BAD_REQUEST';
  return pageOf(pages, id) ? null : 'NOT_IN_BOOK';
}

/** Showcase entries whose slot is still filled; a slot emptied later just drops out. */
export function visibleShowcase(doc: ProfileDoc, entries: BookEntries): string[] {
  return doc.showcase.filter((id) => !!(entries[id] && entries[id].slot));
}

/** Pages whose every record has been found. */
export function completedPages(entries: BookEntries, pages: BookPage[]): string[] {
  return pages.filter((p) => p.items.length > 0 && p.items.every((id) => !!entries[id])).map((p) => p.id);
}
