// SELL and SALVAGE inside the world match (docs/protokol.md, Ekonomi).
// The match is the only writer of the bag, so its cached stacks and item count stay true.
// Items, stacks and the wallet change in one storage transaction.
import { ECONOMY, FLOAT_TABLE } from '../config';
import { LAKE_POOL } from '../data/lake-pool';
import { EconomyResultMsg, OpCode } from '../protocol';
import { Category } from '../rules/catch';
import { EconomyAction, OwnedItem, parseEconomyRequest, planEconomy } from '../rules/economy';
import { Fisher } from './fishing';
import { StoredItem, readWallet, stacksWrite } from './playerData';

const CATEGORY: { [defId: string]: Category } = {};
for (const d of LAKE_POOL) CATEGORY[d.id] = d.category;
const categoryOf = (defId: string): Category | null => CATEGORY[defId] || null;

/** Wallet key per action. Dust is a wallet value only the server changes; it cannot be traded. */
const CURRENCY: { [a in EconomyAction]: 'coin' | 'dust' } = { sell: 'coin', salvage: 'dust' };

function reply(dispatcher: nkruntime.MatchDispatcher, f: Fisher, msg: EconomyResultMsg): void {
  dispatcher.broadcastMessage(OpCode.ECONOMY_RESULT, JSON.stringify(msg), [f.presence], null, true);
}

export function handleEconomy(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  f: Fisher,
  action: EconomyAction,
  body: unknown,
): void {
  const userId = f.presence.userId;
  const fail = (reason: string) => reply(dispatcher, f, { action, ok: false, reason, ...readWallet(nk, userId) });

  const req = parseEconomyRequest(body);
  if (!req) return fail('BAD_REQUEST');
  if (req.items.length + req.stacks.length > ECONOMY.maxEntries) return fail('TOO_MANY');

  // Only the requested items are read; book slot items are not in the bag.
  const owned: { [instanceId: string]: OwnedItem } = {};
  if (req.items.length > 0) {
    const objs = nk.storageRead(req.items.map((key) => ({ collection: 'items', key, userId })));
    for (const o of objs) {
      const item = o.value as StoredItem;
      if (!item.inBook) owned[o.key] = { instanceId: item.instanceId, tier: item.tier, float: item.float };
    }
  }

  const plan = planEconomy(action, req, owned, f.bag.stacks, categoryOf, FLOAT_TABLE, ECONOMY);
  if (!plan.ok) return fail(plan.reason);

  const stacks: { [defId: string]: number } = { ...f.bag.stacks };
  for (const defId in plan.stacksAfter) {
    if (plan.stacksAfter[defId] > 0) stacks[defId] = plan.stacksAfter[defId];
    else delete stacks[defId];
  }
  const writes = plan.removedStacks.length > 0 ? [stacksWrite(userId, stacks)] : [];
  const deletes = plan.removeItems.map((key) => ({ collection: 'items', key, userId }));
  const currency = CURRENCY[action];
  let wallet: { [k: string]: number };
  try {
    const res = nk.multiUpdate(null, writes, deletes, [
      { userId, changeset: { [currency]: plan.gained }, metadata: { action, items: plan.removeItems.length, stacks: plan.removedStacks } },
    ]);
    wallet = res.walletUpdateAcks[0].updated;
  } catch (e) {
    logger.error('Economy %s failed: %s', action, String(e));
    return fail('BAD_REQUEST');
  }

  f.bag.stacks = stacks;
  f.bag.items = Math.max(0, f.bag.items - plan.removeItems.length);
  reply(dispatcher, f, {
    action,
    ok: true,
    coin: wallet.coin || 0,
    dust: wallet.dust || 0,
    gained: plan.gained,
    items: plan.removeItems,
    stacks: plan.removedStacks,
  });
}
