// Collection Book actions inside the world match (docs/protokol.md, Collection Book).
// The match is the only writer of a player's book and bag, so its cached copies stay true.
import { SCORE } from '../config';
import { BOOK_PAGES } from '../data/book-pages';
import { BookResultMsg, OpCode } from '../protocol';
import { place, scoreOf } from '../rules/book';
import { Fisher } from './fishing';
import { StoredItem, bookWrite, inBag, itemWrite, publicItem, readItem } from './playerData';

function reply(dispatcher: nkruntime.MatchDispatcher, f: Fisher, msg: BookResultMsg): void {
  dispatcher.broadcastMessage(OpCode.BOOK_RESULT, JSON.stringify(msg), [f.presence], null, true);
}

/** BOOK_PLACE: moves a bag item into its slot; the slot's old copy goes to the bag. */
export function handleBookPlace(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  f: Fisher,
  body: unknown,
): void {
  const instanceId = typeof body === 'object' && body !== null ? (body as { instanceId?: unknown }).instanceId : undefined;
  if (typeof instanceId !== 'string' || instanceId.length === 0 || instanceId.length > 64) {
    return reply(dispatcher, f, { ok: false, reason: 'BAD_REQUEST' });
  }
  const userId = f.presence.userId;
  const item = readItem(nk, userId, instanceId);
  if (!item || !inBag(item)) return reply(dispatcher, f, { ok: false, reason: 'NOT_OWNED' });

  const res = place(f.book, BOOK_PAGES, item.defId, { instanceId: item.instanceId, tier: item.tier, float: item.float });
  if (!res.ok) return reply(dispatcher, f, { ok: false, reason: res.reason, defId: item.defId });

  const placed: StoredItem = { ...publicItem(item), inBook: true };
  const writes = [itemWrite(userId, placed), bookWrite(userId, res.entries)];
  let previous: StoredItem | null = null;
  if (res.previous) {
    const old = readItem(nk, userId, res.previous.instanceId);
    if (old) {
      previous = publicItem(old);
      writes.push(itemWrite(userId, previous));
    }
  }
  try {
    nk.storageWrite(writes);
  } catch (e) {
    logger.error('Book place failed: %s', String(e));
    return reply(dispatcher, f, { ok: false, reason: 'BAD_REQUEST' });
  }
  f.book = res.entries;
  // One item left the bag; a swapped-out copy came back.
  if (!previous) f.bag.items = Math.max(0, f.bag.items - 1);
  const page = BOOK_PAGES.filter((p) => p.items.indexOf(item.defId) >= 0)[0];
  reply(dispatcher, f, {
    ok: true,
    defId: item.defId,
    page: page ? page.id : undefined,
    slot: publicItem(placed),
    previous: previous || undefined,
    score: scoreOf(f.book, BOOK_PAGES, SCORE),
  });
}
