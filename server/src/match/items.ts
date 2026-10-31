// Where a new Float item goes: its book slot if it is the first copy, else the bag.
// Shared by fishing, merge and craft (docs/tasarim/06-defter.md 8.1.1).
import { BOOK_LUCK, SCORE } from '../config';
import { currentContent } from './content';
import { FishBookMsg, ItemInstance } from '../protocol';
import { BookEntries, discover, luckOf, onCatch, scoreOf } from '../rules/book';
import { StoredItem, bookWrite, itemWrite } from './playerData';

export interface Placement {
  writes: nkruntime.StorageWriteRequest[];
  /** New book entries if the item was discovered, else null. */
  book: BookEntries | null;
  msg?: FishBookMsg;
  /** True if the item takes a bag slot. */
  inBag: boolean;
}

export function placeNewItem(userId: string, entries: BookEntries, item: ItemInstance): Placement {
  const pages = currentContent().pages;
  const where = onCatch(entries, pages, item.defId, item.float);
  if (where.kind === 'discovered') {
    const book = discover(entries, item.defId, { instanceId: item.instanceId, tier: item.tier, float: item.float }, item.obtainedAt);
    const stored: StoredItem = { ...item, inBook: true };
    return {
      writes: [itemWrite(userId, stored), bookWrite(userId, book)],
      book,
      msg: {
        page: where.page,
        kind: 'discovered',
        pageComplete: where.pageComplete,
        luck: luckOf(book, pages, BOOK_LUCK),
        score: scoreOf(book, pages, SCORE),
      },
      inBag: false,
    };
  }
  return {
    writes: [itemWrite(userId, item)],
    book: null,
    msg: where.kind === 'copy' ? { page: where.page, kind: 'copy', better: where.better } : undefined,
    inBag: true,
  };
}
