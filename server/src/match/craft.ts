// MERGE (3 into 1) and CRAFT inside the world match (docs/protokol.md, Birleştirme ve craft).
// Inputs, the new item, the book and the dust change in one storage transaction.
import { BAG, CRAFT, FLOAT_TABLE } from '../config';
import { recipeById } from '../data/recipes';
import { CraftResultMsg, ItemInstance, OpCode } from '../protocol';
import { rollFloat } from '../rules/catch';
import { CraftItem, CraftResult, craftBands, isStackOutput, parseCraft, parseMerge, planCraft, planMerge } from '../rules/craft';
import { Fisher } from './fishing';
import { placeNewItem } from './items';
import { StoredItem, inBag, readWallet, stacksWrite } from './playerData';

type Action = 'merge' | 'craft';

function reply(dispatcher: nkruntime.MatchDispatcher, f: Fisher, msg: CraftResultMsg): void {
  dispatcher.broadcastMessage(OpCode.CRAFT_RESULT, JSON.stringify(msg), [f.presence], null, true);
}

/** Reads the picked items; book slot items and ones the player does not own are left out. `locked` is true if any is locked. */
function readPicked(nk: nkruntime.Nakama, userId: string, ids: string[]): { items: CraftItem[]; locked: boolean } {
  const out: CraftItem[] = [];
  let locked = false;
  if (ids.length === 0) return { items: out, locked };
  for (const o of nk.storageRead(ids.map((key) => ({ collection: 'items', key, userId })))) {
    const item = o.value as StoredItem;
    if (!inBag(item)) continue;
    if (item.locked) locked = true;
    out.push({ instanceId: item.instanceId, defId: item.defId, tier: item.tier, float: item.float });
  }
  return { items: out, locked };
}

export function handleCraft(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  f: Fisher,
  action: Action,
  body: unknown,
): void {
  const userId = f.presence.userId;
  const dust = readWallet(nk, userId).dust;
  const fail = (reason: string) => reply(dispatcher, f, { action, ok: false, reason, dust });

  let plan: CraftResult;
  if (action === 'merge') {
    const ids = parseMerge(body, CRAFT);
    if (!ids) return fail('BAD_REQUEST');
    const picked = readPicked(nk, userId, ids);
    if (picked.locked) return fail('LOCKED');
    plan = picked.items.length === ids.length ? planMerge(picked.items, dust, CRAFT) : { ok: false, reason: 'NOT_OWNED' };
  } else {
    const req = parseCraft(body, BAG.slots);
    if (!req) return fail('BAD_REQUEST');
    const picked = readPicked(nk, userId, req.items);
    if (picked.locked) return fail('LOCKED');
    if (picked.items.length !== req.items.length) return fail('NOT_OWNED');
    plan = planCraft(recipeById(req.recipeId), picked.items, f.bag, dust, BAG, CRAFT);
  }
  if (!plan.ok) return fail(plan.reason);

  const stacks: { [defId: string]: number } = { ...f.bag.stacks };
  const usedStacks: { defId: string; count: number }[] = [];
  for (const defId in plan.stacksAfter) {
    usedStacks.push({ defId, count: (f.bag.stacks[defId] || 0) - plan.stacksAfter[defId] });
    if (plan.stacksAfter[defId] > 0) stacks[defId] = plan.stacksAfter[defId];
    else delete stacks[defId];
  }

  // A stack result (bait) has no Float and no book record.
  const out = plan.output;
  let item: ItemInstance | undefined;
  let stack: { defId: string; count: number } | undefined;
  let placed: ReturnType<typeof placeNewItem> | null = null;
  const writes: nkruntime.StorageWriteRequest[] = [];
  if (isStackOutput(out)) {
    stacks[out.defId] = (stacks[out.defId] || 0) + out.count;
    stack = { defId: out.defId, count: stacks[out.defId] };
  } else {
    item = {
      instanceId: nk.uuidv4(),
      defId: out.defId,
      tier: out.tier,
      float: rollFloat(craftBands(FLOAT_TABLE, plan.inputAverage, plan.maxFloat, CRAFT), Math.random).value,
      source: action,
      obtainedAt: Date.now(),
    };
    placed = placeNewItem(userId, f.book, item);
    writes.push(...placed.writes);
  }
  if (usedStacks.length > 0 || stack) writes.push(stacksWrite(userId, stacks));
  const deletes = plan.removeItems.map((key) => ({ collection: 'items', key, userId }));
  let dustAfter: number;
  try {
    const res = nk.multiUpdate(null, writes, deletes, [
      { userId, changeset: { dust: -plan.dustCost }, metadata: { action, output: out.defId, items: plan.removeItems.length } },
    ]);
    dustAfter = res.walletUpdateAcks[0].updated.dust || 0;
  } catch (e) {
    // The wallet refuses to go negative, so a race on dust also ends here.
    logger.error('%s failed: %s', action, String(e));
    return fail('BAD_REQUEST');
  }

  f.bag.stacks = stacks;
  f.bag.items = Math.max(0, f.bag.items - plan.removeItems.length) + (placed && placed.inBag ? 1 : 0);
  if (placed && placed.book) f.book = placed.book;
  reply(dispatcher, f, { action, ok: true, dust: dustAfter, item, stack, book: placed ? placed.msg : undefined, items: plan.removeItems, stacks: usedStacks });
}
