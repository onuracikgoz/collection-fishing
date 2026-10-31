// ITEM_DISCARD inside the world match (docs/protokol.md, Eşya atma): the bag's trash can.
// The match is the only writer of the bag, so the cached item count and stacks are kept in step.
import { ItemDiscardResultMsg, OpCode } from '../protocol';
import { discardFromStacks, parseDiscard } from '../rules/discard';
import { Fisher } from './fishing';
import { inBag, readItem, stacksWrite } from './playerData';

export function handleItemDiscard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  f: Fisher,
  inTrade: boolean,
  body: unknown,
): void {
  const reply = (msg: ItemDiscardResultMsg) => dispatcher.broadcastMessage(OpCode.ITEM_DISCARD_RESULT, JSON.stringify(msg), [f.presence], null, true);
  const req = parseDiscard(body);
  if (!req) return reply({ ok: false, reason: 'BAD_REQUEST' });
  if (inTrade) return reply({ ok: false, ...req, reason: 'BUSY' });
  const userId = f.presence.userId;
  try {
    if ('instanceId' in req) {
      const item = readItem(nk, userId, req.instanceId);
      if (!item || !inBag(item)) return reply({ ok: false, instanceId: req.instanceId, reason: 'NOT_OWNED' });
      if (item.locked === true) return reply({ ok: false, instanceId: req.instanceId, reason: 'LOCKED' });
      nk.storageDelete([{ collection: 'items', key: req.instanceId, userId }]);
      f.bag.items = Math.max(0, f.bag.items - 1);
      logger.info('discard %s item %s (%s)', userId, req.instanceId, item.defId);
      return reply({ ok: true, instanceId: req.instanceId, defId: item.defId });
    }
    const plan = discardFromStacks(f.bag.stacks, req.defId, req.count);
    if (!plan.ok) return reply({ ok: false, defId: req.defId, count: req.count, reason: plan.reason });
    nk.storageWrite([stacksWrite(userId, plan.stacks)]);
    f.bag.stacks = plan.stacks;
    logger.info('discard %s %d x %s', userId, req.count, req.defId);
    return reply({ ok: true, defId: req.defId, count: req.count });
  } catch (e) {
    logger.error('Discard failed: %s', String(e));
    return reply({ ok: false, reason: 'BAD_REQUEST' });
  }
}
