// ITEM_LOCK inside the world match (docs/protokol.md, Eşya kilidi).
import { ItemLockResultMsg, OpCode } from '../protocol';
import { parseLock } from '../rules/lock';
import { Fisher } from './fishing';
import { StoredItem, inBag, itemWrite, readItem } from './playerData';

export function handleItemLock(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, f: Fisher, body: unknown): void {
  const reply = (msg: ItemLockResultMsg) => dispatcher.broadcastMessage(OpCode.ITEM_LOCK_RESULT, JSON.stringify(msg), [f.presence], null, true);
  const req = parseLock(body);
  if (!req) return reply({ instanceId: '', locked: false, ok: false, reason: 'BAD_REQUEST' });
  const userId = f.presence.userId;
  const item = readItem(nk, userId, req.instanceId);
  // Only bag items: the book slot and the stash keep their items as they are.
  if (!item || !inBag(item)) return reply({ instanceId: req.instanceId, locked: false, ok: false, reason: 'NOT_OWNED' });
  if ((item.locked === true) !== req.locked) {
    const next: StoredItem = { ...item };
    if (req.locked) next.locked = true;
    else delete next.locked;
    try {
      nk.storageWrite([itemWrite(userId, next)]);
    } catch (e) {
      logger.error('Saving item lock failed: %s', String(e));
      return reply({ instanceId: req.instanceId, locked: item.locked === true, ok: false, reason: 'BAD_REQUEST' });
    }
  }
  reply({ instanceId: req.instanceId, locked: req.locked, ok: true });
}
