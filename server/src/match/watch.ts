// Storage for bot and multi-account signals (rules/watch.ts). Server-only:
//   watch/stats    WatchStats     (written by the world match)
//   watch/account  AccountWatch   (written on every device login)
// Neither is readable by clients; only the dev dashboard (and later the admin panel) reads them.
import { AccountWatch, WatchStats, changeMark, normalizeStats } from '../rules/watch';

export const WATCH_COLLECTION = 'watch';
const READ_NONE = 0 as nkruntime.ReadPermissionValues;
const WRITE_SERVER = 0 as nkruntime.WritePermissionValues;

export function readWatch(nk: nkruntime.Nakama, userId: string): WatchStats {
  const objs = nk.storageRead([{ collection: WATCH_COLLECTION, key: 'stats', userId }]);
  return normalizeStats(objs.length > 0 ? objs[0].value : null);
}

export function watchWrite(userId: string, stats: WatchStats): nkruntime.StorageWriteRequest {
  return { collection: WATCH_COLLECTION, key: 'stats', userId, value: stats as unknown as { [k: string]: unknown }, permissionRead: READ_NONE, permissionWrite: WRITE_SERVER };
}

export function normalizeAccount(v: unknown): AccountWatch | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as { [k: string]: unknown };
  const s = (x: unknown) => (typeof x === 'string' ? x : '');
  const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : 0);
  return { createdIp: s(o.createdIp), createdAt: n(o.createdAt), lastIp: s(o.lastIp), lastAt: n(o.lastAt) };
}

export function accountWrite(userId: string, a: AccountWatch): nkruntime.StorageWriteRequest {
  return { collection: WATCH_COLLECTION, key: 'account', userId, value: a as unknown as { [k: string]: unknown }, permissionRead: READ_NONE, permissionWrite: WRITE_SERVER };
}

/** Called after each device login: the first one also stores where the account was made. */
export function recordLogin(nk: nkruntime.Nakama, userId: string, ip: string, created: boolean, nowMs: number): void {
  const objs = created ? [] : nk.storageRead([{ collection: WATCH_COLLECTION, key: 'account', userId }]);
  const old = objs.length > 0 ? normalizeAccount(objs[0].value) : null;
  const a: AccountWatch = old && old.createdAt ? { ...old, lastIp: ip, lastAt: nowMs } : { createdIp: created ? ip : '', createdAt: created ? nowMs : 0, lastIp: ip, lastAt: nowMs };
  nk.storageWrite([accountWrite(userId, a)]);
}

/** The part of a match player that holds bot signals. */
export interface Watched {
  presence: nkruntime.Presence;
  watch: WatchStats;
  watchSavedAt: number;
  /** changeMark of the last saved stats; unchanged stats are not written again. */
  watchMark?: string;
}

/** Saves the bot signals of these players, skipping the ones that did not change. */
export function saveWatch(nk: nkruntime.Nakama, logger: nkruntime.Logger, players: Watched[], now: number): void {
  const changed: Watched[] = [];
  for (const p of players) {
    p.watchSavedAt = now;
    if (changeMark(p.watch) !== p.watchMark) changed.push(p);
  }
  if (changed.length === 0) return;
  try {
    nk.storageWrite(changed.map((p) => watchWrite(p.presence.userId, p.watch)));
    for (const p of changed) p.watchMark = changeMark(p.watch);
  } catch (e) {
    logger.error('Saving watch stats failed: %s', String(e));
  }
}
