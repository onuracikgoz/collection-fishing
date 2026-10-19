// Persistent player data: energy and bag. Storage layout:
//   player/energy  { value, at, online }   (at = wall-clock ms of the last save)
//   items/<instanceId>  StoredItem          (one record per Float item; inBook = in a book slot)
//   bag/stacks  { stacks: { defId: count } }
//   book/entries  { entries: BookEntries }  (public: the Collection Book is public)
//   profile/card  ProfileDoc               (public: showcase and "Arıyorum")
import { BAG, ENERGY } from '../config';
import { InventoryResponse, ItemInstance } from '../protocol';
import { BookEntries } from '../rules/book';
import { ProfileDoc } from '../rules/profile';
import { BagSummary, slotsUsed } from '../rules/bag';
import { regenOffline } from '../rules/energy';

const READ_OWNER = 1 as nkruntime.ReadPermissionValues;
const READ_PUBLIC = 2 as nkruntime.ReadPermissionValues;
const WRITE_SERVER = 0 as nkruntime.WritePermissionValues;

/** An item as stored: book slot items stay in `items` so one write moves them atomically. */
export interface StoredItem extends ItemInstance {
  inBook?: boolean;
}

/** The item without storage-only fields, as sent to clients. */
export function publicItem(item: StoredItem): ItemInstance {
  const { inBook: _inBook, ...rest } = item;
  return rest;
}

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

/** Every stored item, bag and book. */
function listItems(nk: nkruntime.Nakama, userId: string): StoredItem[] {
  const out: StoredItem[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 20; page++) {
    const res: nkruntime.StorageObjectList = nk.storageList(userId, 'items', 100, cursor);
    for (const o of res.objects || []) out.push(o.value as StoredItem);
    cursor = res.cursor;
    if (!cursor) break;
  }
  return out;
}

export function loadBag(nk: nkruntime.Nakama, userId: string): BagSummary {
  return { items: listItems(nk, userId).filter((i) => !i.inBook).length, stacks: readStacks(nk, userId) };
}

export function readItem(nk: nkruntime.Nakama, userId: string, instanceId: string): StoredItem | null {
  const objs = nk.storageRead([{ collection: 'items', key: instanceId, userId }]);
  return objs.length > 0 ? (objs[0].value as StoredItem) : null;
}

export function itemWrite(userId: string, item: StoredItem): nkruntime.StorageWriteRequest {
  return { collection: 'items', key: item.instanceId, userId, value: item, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
}

export function stacksWrite(userId: string, stacks: { [defId: string]: number }): nkruntime.StorageWriteRequest {
  return { collection: 'bag', key: 'stacks', userId, value: { stacks }, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
}

export function readBook(nk: nkruntime.Nakama, userId: string): BookEntries {
  const objs = nk.storageRead([{ collection: 'book', key: 'entries', userId }]);
  const v = objs.length > 0 ? (objs[0].value as { entries?: BookEntries }) : {};
  return v.entries || {};
}

export function bookWrite(userId: string, entries: BookEntries): nkruntime.StorageWriteRequest {
  return { collection: 'book', key: 'entries', userId, value: { entries }, permissionRead: READ_PUBLIC, permissionWrite: WRITE_SERVER };
}

/** Items sitting in book slots, by instance id. */
export function readBookItems(nk: nkruntime.Nakama, userId: string, entries: BookEntries): { [instanceId: string]: ItemInstance } {
  const keys: nkruntime.StorageReadRequest[] = [];
  for (const defId in entries) {
    const slot = entries[defId].slot;
    if (slot) keys.push({ collection: 'items', key: slot.instanceId, userId });
  }
  const out: { [instanceId: string]: ItemInstance } = {};
  if (keys.length === 0) return out;
  for (const o of nk.storageRead(keys)) out[o.key] = publicItem(o.value as StoredItem);
  return out;
}

export function readInventory(nk: nkruntime.Nakama, userId: string): InventoryResponse {
  const items = listItems(nk, userId).filter((i) => !i.inBook).map(publicItem);
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

export function readProfile(nk: nkruntime.Nakama, userId: string): ProfileDoc {
  const objs = nk.storageRead([{ collection: 'profile', key: 'card', userId }]);
  const v = objs.length > 0 ? (objs[0].value as Partial<ProfileDoc>) : {};
  return { showcase: Array.isArray(v.showcase) ? v.showcase : [], hunting: typeof v.hunting === 'string' ? v.hunting : undefined };
}

export function profileWrite(userId: string, doc: ProfileDoc): nkruntime.StorageWriteRequest {
  const value: { showcase: string[]; hunting?: string } = { showcase: doc.showcase };
  if (doc.hunting) value.hunting = doc.hunting;
  return { collection: 'profile', key: 'card', userId, value, permissionRead: READ_PUBLIC, permissionWrite: WRITE_SERVER };
}
