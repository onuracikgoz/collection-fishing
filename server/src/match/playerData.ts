// Persistent player data: energy and bag. Storage layout:
//   player/energy  { value, at, online }   (at = wall-clock ms of the last save)
//   items/<instanceId>  ItemInstance        (one record per Float item)
//   bag/stacks  { stacks: { defId: count } }
import { BAG, ENERGY } from '../config';
import { InventoryResponse, ItemInstance } from '../protocol';
import { BagSummary, slotsUsed } from '../rules/bag';
import { regenOffline } from '../rules/energy';

const READ_OWNER = 1 as nkruntime.ReadPermissionValues;
const WRITE_SERVER = 0 as nkruntime.WritePermissionValues;

interface EnergyDoc {
  value: number;
  at: number;
  online: boolean;
}

function readEnergyDoc(nk: nkruntime.Nakama, userId: string): EnergyDoc | null {
  const objs = nk.storageRead([{ collection: 'player', key: 'energy', userId }]);
  if (objs.length === 0) return null;
  const v = objs[0].value as Partial<EnergyDoc>;
  if (typeof v.value !== 'number' || typeof v.at !== 'number') return null;
  return { value: v.value, at: v.at, online: !!v.online };
}

/** Current energy; offline refill only counts while the player was not in a match. */
export function currentEnergy(nk: nkruntime.Nakama, userId: string): number {
  const doc = readEnergyDoc(nk, userId);
  if (!doc) return ENERGY.max;
  return doc.online ? doc.value : regenOffline(doc.value, Date.now() - doc.at, ENERGY);
}

export function energyWrite(userId: string, value: number, online: boolean): nkruntime.StorageWriteRequest {
  return {
    collection: 'player',
    key: 'energy',
    userId,
    value: { value, at: Date.now(), online },
    permissionRead: READ_OWNER,
    permissionWrite: WRITE_SERVER,
  };
}

function readStacks(nk: nkruntime.Nakama, userId: string): { [defId: string]: number } {
  const objs = nk.storageRead([{ collection: 'bag', key: 'stacks', userId }]);
  const v = objs.length > 0 ? (objs[0].value as { stacks?: { [defId: string]: number } }) : {};
  return v.stacks || {};
}

function listItems(nk: nkruntime.Nakama, userId: string): ItemInstance[] {
  const out: ItemInstance[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 20; page++) {
    const res: nkruntime.StorageObjectList = nk.storageList(userId, 'items', 100, cursor);
    for (const o of res.objects || []) out.push(o.value as ItemInstance);
    cursor = res.cursor;
    if (!cursor) break;
  }
  return out;
}

export function loadBag(nk: nkruntime.Nakama, userId: string): BagSummary {
  return { items: listItems(nk, userId).length, stacks: readStacks(nk, userId) };
}

export function itemWrite(userId: string, item: ItemInstance): nkruntime.StorageWriteRequest {
  return { collection: 'items', key: item.instanceId, userId, value: item, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
}

export function stacksWrite(userId: string, stacks: { [defId: string]: number }): nkruntime.StorageWriteRequest {
  return { collection: 'bag', key: 'stacks', userId, value: { stacks }, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
}

export function readInventory(nk: nkruntime.Nakama, userId: string): InventoryResponse {
  const items = listItems(nk, userId);
  const stacks = readStacks(nk, userId);
  return {
    energy: currentEnergy(nk, userId),
    energyMax: ENERGY.max,
    slotsUsed: slotsUsed({ items: items.length, stacks }, BAG),
    slotsMax: BAG.slots,
    items,
    stacks: Object.keys(stacks).map((defId) => ({ defId, count: stacks[defId] })),
  };
}
