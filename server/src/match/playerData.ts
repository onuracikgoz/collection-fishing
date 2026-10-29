// Persistent player data: energy and bag. Storage layout:
//   player/energy  { value, at, online }   (at = wall-clock ms of the last save)
//   items/<instanceId>  StoredItem          (one record per Float item; inBook = in a book slot, inStash = in the stash)
//   bag/stacks  { stacks: { defId: count } }
//   player/rod  { level, durability }
//   player/status_emote  { emote }         (worn status emote; absent = none)
//   player/trade_lock  { until }           (ms since epoch; a newly linked Steam account cannot trade until then)
//   player/emotes_owned  { ids: [] }       (non-free status emotes owned; written by shop / supporter / book systems)
//   stash/state  { level, stacks: { defId: count } }
//   book/entries  { entries: BookEntries }  (public: the Collection Book is public)
//   profile/card  ProfileDoc               (public: showcase and "Arıyorum")
// Coin and dust live in the Nakama wallet: { coin, dust }.
import { BAG, EMOTES, ENERGY, ROD } from '../config';
import { InventoryResponse, ItemInstance } from '../protocol';
import { Rod, normalizeRod, rodView } from '../rules/rod';
import { BookEntries } from '../rules/book';
import { ProfileDoc } from '../rules/profile';
import { BagSummary, slotsUsed } from '../rules/bag';
import { regenOffline } from '../rules/energy';
import { canWear, normalizeOwned } from '../rules/emote';

const READ_OWNER = 1 as nkruntime.ReadPermissionValues;
const READ_PUBLIC = 2 as nkruntime.ReadPermissionValues;
const WRITE_SERVER = 0 as nkruntime.WritePermissionValues;

/** An item as stored: book slot and stash items stay in `items` so one write moves them atomically. */
export interface StoredItem extends ItemInstance {
  inBook?: boolean;
  inStash?: boolean;
}

/** The item without storage-only fields, as sent to clients. */
export function publicItem(item: StoredItem): ItemInstance {
  const { inBook: _inBook, inStash: _inStash, ...rest } = item;
  return rest;
}

/** True if the item sits in the bag: not in a book slot, not in the stash. */
export function inBag(item: StoredItem): boolean {
  return !item.inBook && !item.inStash;
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

/** Every stored item: bag, book and stash. */
export function listItems(nk: nkruntime.Nakama, userId: string): StoredItem[] {
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
  return { items: listItems(nk, userId).filter(inBag).length, stacks: readStacks(nk, userId) };
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

/** Coin and dust from the Nakama wallet (server-only writes). */
export function readWallet(nk: nkruntime.Nakama, userId: string): { coin: number; dust: number } {
  const w = nk.accountGetId(userId).wallet || {};
  return { coin: w.coin || 0, dust: w.dust || 0 };
}

export function readInventory(nk: nkruntime.Nakama, userId: string): InventoryResponse {
  const items = listItems(nk, userId).filter(inBag).map(publicItem);
  const stacks = readStacks(nk, userId);
  return {
    energy: currentEnergy(nk, userId),
    energyMax: ENERGY.max,
    slotsUsed: slotsUsed({ items: items.length, stacks }, BAG),
    slotsMax: BAG.slots,
    items,
    stacks: Object.keys(stacks).map((defId) => ({ defId, count: stacks[defId] })),
    ...readWallet(nk, userId),
    rod: rodView(readRod(nk, userId), ROD),
  };
}

export function readRod(nk: nkruntime.Nakama, userId: string): Rod {
  const objs = nk.storageRead([{ collection: 'player', key: 'rod', userId }]);
  return normalizeRod(objs.length > 0 ? objs[0].value : null, ROD);
}

export function rodWrite(userId: string, rod: Rod): nkruntime.StorageWriteRequest {
  return { collection: 'player', key: 'rod', userId, value: { level: rod.level, durability: rod.durability }, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
}

export interface EmoteData {
  /** Status emote worn, if still allowed. */
  status?: string;
  /** Non-free status emotes owned. */
  owned: string[];
}

/** Loads the worn status emote and owned list; a worn emote the player no longer owns is dropped. */
export function readEmotes(nk: nkruntime.Nakama, userId: string): EmoteData {
  const objs = nk.storageRead([
    { collection: 'player', key: 'emotes_owned', userId },
    { collection: 'player', key: 'status_emote', userId },
  ]);
  let owned: string[] = [];
  let worn: unknown;
  for (const o of objs) {
    if (o.key === 'emotes_owned') owned = normalizeOwned(o.value, EMOTES);
    else worn = (o.value as { emote?: unknown }).emote;
  }
  return { status: typeof worn === 'string' && canWear(worn, owned, EMOTES) ? worn : undefined, owned };
}

export function statusEmoteWrite(userId: string, emote: string | null): nkruntime.StorageWriteRequest {
  return { collection: 'player', key: 'status_emote', userId, value: { emote }, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
}

/** Time until which this account may not trade (0 = free). */
export function readTradeLock(nk: nkruntime.Nakama, userId: string): number {
  const objs = nk.storageRead([{ collection: 'player', key: 'trade_lock', userId }]);
  const v = objs.length > 0 ? (objs[0].value as { until?: unknown }).until : 0;
  return typeof v === 'number' ? v : 0;
}

export function tradeLockWrite(userId: string, until: number): nkruntime.StorageWriteRequest {
  return { collection: 'player', key: 'trade_lock', userId, value: { until }, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
}

export interface StashState {
  level: number;
  stacks: { [defId: string]: number };
}

export function readStashState(nk: nkruntime.Nakama, userId: string): StashState {
  const objs = nk.storageRead([{ collection: 'stash', key: 'state', userId }]);
  const v = objs.length > 0 ? (objs[0].value as Partial<StashState>) : {};
  return { level: typeof v.level === 'number' ? v.level : 0, stacks: v.stacks || {} };
}

export function stashWrite(userId: string, state: StashState): nkruntime.StorageWriteRequest {
  return { collection: 'stash', key: 'state', userId, value: state, permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER };
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
