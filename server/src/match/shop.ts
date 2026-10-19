// REPAIR_ROD and BUY_BAIT inside the world match (docs/protokol.md, Olta ve özel yem).
// Coin and the rod or bag change in one storage transaction; the wallet refuses to go negative.
import { BAG, BAIT, ROD } from '../config';
import { OpCode, ShopResultMsg } from '../protocol';
import { parseBuyBait, planBuyBait } from '../rules/bait';
import { planRepair, rodView } from '../rules/rod';
import { Fisher } from './fishing';
import { readWallet, rodWrite, stacksWrite } from './playerData';

export type ShopAction = 'repair' | 'buy_bait';

function reply(dispatcher: nkruntime.MatchDispatcher, f: Fisher, msg: ShopResultMsg): void {
  dispatcher.broadcastMessage(OpCode.SHOP_RESULT, JSON.stringify(msg), [f.presence], null, true);
}

export function handleShop(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  f: Fisher,
  action: ShopAction,
  body: unknown,
): void {
  const userId = f.presence.userId;
  const coin = readWallet(nk, userId).coin;
  const fail = (reason: string) => reply(dispatcher, f, { action, ok: false, reason, coin });

  let write: nkruntime.StorageWriteRequest;
  let cost: number;
  let after: () => ShopResultMsg;
  if (action === 'repair') {
    const plan = planRepair(f.rod, coin, ROD);
    if (!plan.ok) return fail(plan.reason);
    write = rodWrite(userId, plan.rod);
    cost = plan.cost;
    after = () => {
      f.rod = plan.rod;
      return { action, ok: true, coin: 0, spent: plan.cost, rod: rodView(plan.rod, ROD) };
    };
  } else {
    const req = parseBuyBait(body, BAIT);
    if (!req) return fail('BAD_REQUEST');
    const plan = planBuyBait(req.defId, req.count, coin, f.bag, BAG, BAIT);
    if (!plan.ok) return fail(plan.reason);
    const stacks = { ...f.bag.stacks, [req.defId]: plan.count };
    write = stacksWrite(userId, stacks);
    cost = plan.cost;
    after = () => {
      f.bag.stacks = stacks;
      return { action, ok: true, coin: 0, spent: plan.cost, stack: { defId: req.defId, count: plan.count } };
    };
  }

  let coinAfter: number;
  try {
    const res = nk.multiUpdate(null, [write], [], [{ userId, changeset: { coin: -cost }, metadata: { action } }]);
    coinAfter = res.walletUpdateAcks[0].updated.coin || 0;
  } catch (e) {
    logger.error('Shop %s failed: %s', action, String(e));
    return fail('NOT_ENOUGH_COIN');
  }
  reply(dispatcher, f, { ...after(), coin: coinAfter });
}
