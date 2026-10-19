// The stash inside the world match (docs/protokol.md, Depo). Only opens at the bank.
// The match is the only writer of bag and stash, so its cached summaries stay true.
// Items, stacks, stash state and the wallet change in one storage transaction.
import { BAG, STASH } from '../config';
import { OpCode, StashResultMsg, StashView } from '../protocol';
import { BagSummary, slotsUsed } from '../rules/bag';
import { parseEconomyRequest } from '../rules/economy';
import { atBank, planExpand, planMove, stashBagConfig } from '../rules/stash';
import { Fisher } from './fishing';
import { StashState, StoredItem, inBag, itemWrite, listItems, publicItem, readStashState, readWallet, stacksWrite, stashWrite } from './playerData';

export type StashAction = 'open' | 'put' | 'take' | 'expand';

/** What the match keeps about a stash once it was opened. */
export interface StashCache {
  level: number;
  summary: BagSummary;
}

export interface Stasher extends Fisher {
  move: { x: number; y: number };
  stash?: StashCache;
}

function reply(dispatcher: nkruntime.MatchDispatcher, f: Fisher, msg: StashResultMsg): void {
  dispatcher.broadcastMessage(OpCode.STASH_RESULT, JSON.stringify(msg), [f.presence], null, true);
}

function view(nk: nkruntime.Nakama, userId: string, cache: StashCache): StashView {
  const items = listItems(nk, userId).filter((i) => i.inStash).map(publicItem);
  const cfg = stashBagConfig(cache.level, STASH);
  return {
    level: cache.level,
    slotsUsed: slotsUsed(cache.summary, cfg),
    slotsMax: cfg.slots,
    items,
    stacks: Object.keys(cache.summary.stacks).map((defId) => ({ defId, count: cache.summary.stacks[defId] })),
  };
}

function load(nk: nkruntime.Nakama, userId: string): StashCache {
  const state = readStashState(nk, userId);
  const items = listItems(nk, userId).filter((i) => i.inStash).length;
  return { level: state.level, summary: { items, stacks: state.stacks } };
}

const stateOf = (c: StashCache): StashState => ({ level: c.level, stacks: c.summary.stacks });

export function handleStash(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  f: Stasher,
  action: StashAction,
  body: unknown,
): void {
  const userId = f.presence.userId;
  const fail = (reason: string) => reply(dispatcher, f, { action, ok: false, reason });
  if (!atBank(f.move, STASH)) return fail('NOT_AT_BANK');
  if (!f.stash) f.stash = load(nk, userId);
  const cache = f.stash;

  if (action === 'open') return reply(dispatcher, f, { action, ok: true, stash: view(nk, userId, cache) });

  if (action === 'expand') {
    const coin = readWallet(nk, userId).coin;
    const plan = planExpand(cache.level, coin, STASH);
    if (!plan.ok) return fail(plan.reason);
    const next: StashCache = { level: plan.level, summary: cache.summary };
    let coinAfter: number;
    try {
      const res = nk.multiUpdate(null, [stashWrite(userId, stateOf(next))], [], [{ userId, changeset: { coin: -plan.price }, metadata: { action: 'stash_expand', level: plan.level } }]);
      coinAfter = res.walletUpdateAcks[0].updated.coin || 0;
    } catch (e) {
      logger.error('Stash expand failed: %s', String(e));
      return fail('NOT_ENOUGH_COIN');
    }
    f.stash = next;
    return reply(dispatcher, f, { action, ok: true, coin: coinAfter, stash: view(nk, userId, next) });
  }

  const req = parseEconomyRequest(body);
  if (!req) return fail('BAD_REQUEST');
  if (req.items.length + req.stacks.length > STASH.maxEntries) return fail('TOO_MANY');
  const toStash = action === 'put';

  // Read only the asked items and keep the ones on the side they leave from.
  const source: { [instanceId: string]: StoredItem } = {};
  if (req.items.length > 0) {
    for (const o of nk.storageRead(req.items.map((key) => ({ collection: 'items', key, userId })))) {
      const item = o.value as StoredItem;
      if (toStash ? inBag(item) : !!item.inStash) source[o.key] = item;
    }
  }
  const ids: { [id: string]: true } = {};
  for (const id in source) ids[id] = true;
  const plan = toStash
    ? planMove(req, ids, f.bag, cache.summary, stashBagConfig(cache.level, STASH), STASH.maxEntries)
    : planMove(req, ids, cache.summary, f.bag, BAG, STASH.maxEntries);
  if (!plan.ok) return fail(plan.reason === 'FULL' ? (toStash ? 'STASH_FULL' : 'BAG_FULL') : plan.reason);

  const bag = toStash ? plan.from : plan.to;
  const stash: StashCache = { level: cache.level, summary: toStash ? plan.to : plan.from };
  const writes: nkruntime.StorageWriteRequest[] = plan.items.map((id) => {
    const moved: StoredItem = publicItem(source[id]);
    if (toStash) moved.inStash = true;
    return itemWrite(userId, moved);
  });
  if (plan.stacks.length > 0) writes.push(stacksWrite(userId, bag.stacks), stashWrite(userId, stateOf(stash)));
  try {
    nk.multiUpdate(null, writes, [], []);
  } catch (e) {
    logger.error('Stash %s failed: %s', action, String(e));
    return fail('BAD_REQUEST');
  }
  f.bag = bag;
  f.stash = stash;
  reply(dispatcher, f, { action, ok: true, stash: view(nk, userId, stash), items: plan.items, stacks: plan.stacks });
}
