// get_book: anyone's Collection Book (it is public, docs/tasarim/06-defter.md 8.6).
import { BOOK_LUCK, SCORE } from '../config';
import { getContent } from '../match/content';
import { readBook, readBookItems } from '../match/playerData';
import { BookRecordMsg, BookResponse, ErrorCode, errorMessage } from '../protocol';
import { luckOf, scoreOf, stateOf } from '../rules/book';
import { rpcLimit } from './limit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function rpcGetBook(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  rpcLimit(nk, ctx.userId, 'get_book');
  let userId = ctx.userId;
  if (payload) {
    let body: { userId?: unknown };
    try {
      body = JSON.parse(payload);
    } catch (_e) {
      throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'payload is not JSON'), code: 3 } as nkruntime.Error;
    }
    if (body && body.userId !== undefined) {
      if (typeof body.userId !== 'string' || !UUID.test(body.userId)) {
        throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'bad userId'), code: 3 } as nkruntime.Error;
      }
      userId = body.userId;
    }
  }
  if (!userId) throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'no user'), code: 16 } as nkruntime.Error;

  const pages = getContent(nk).pages;
  const entries = readBook(nk, userId);
  const items = readBookItems(nk, userId, entries);
  const res: BookResponse = {
    userId,
    pages: pages.map((p) => {
      let found = 0;
      let filled = 0;
      const records: BookRecordMsg[] = p.items.map((defId) => {
        const state = stateOf(entries, defId);
        if (state === 'unknown') return { state };
        found++;
        const slot = entries[defId].slot;
        const item = slot ? items[slot.instanceId] : undefined;
        if (state === 'filled') filled++;
        return item ? { defId, state, item } : { defId, state };
      });
      return { id: p.id, total: p.items.length, found, filled, records };
    }),
    luck: luckOf(entries, pages, BOOK_LUCK),
    score: scoreOf(entries, pages, SCORE),
  };
  return JSON.stringify(res);
}
