// Account deletion (docs/protokol.md, Hesap silme RPC'leri). A request waits in a queue for 14 days;
// logging in again cancels it; a sweep in a world match deletes what is due and leaves short-lived
// blocks behind so sign-and-delete cannot be used to farm starter rewards or grab names.
import { ACCOUNT_DELETE } from '../config';
import { readSessionDoc } from '../match/playerData';
import { ErrorCode, errorMessage } from '../protocol';
import { AccountIds, isBlocked, isDue, loginIds, loginKey, nameKey, nameMatches, parseDeleteRequest, runAtOf } from '../rules/accountDelete';

const INVALID_ARGUMENT = 3;
const UNAUTHENTICATED = 16;
const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';
const QUEUE = 'deletion_queue';
const LOGIN_BLOCK = 'login_block';
const NAME_RESERVE = 'name_reserve';
/** Notification code shown on the next login: the pending deletion was cancelled by logging in. */
export const NOTIFY_DELETION_CANCELLED = 104;

const READ_NONE = 0 as nkruntime.ReadPermissionValues;
const WRITE_NONE = 0 as nkruntime.WritePermissionValues;

const fail = (code: string, message: string, grpc: number): nkruntime.Error => ({ message: errorMessage(code, message), code: grpc } as nkruntime.Error);

function readRunAt(nk: nkruntime.Nakama, userId: string): number {
  const objs = nk.storageRead([{ collection: QUEUE, key: userId, userId: SYSTEM_USER }]);
  const v = objs.length > 0 ? (objs[0].value as { runAt?: unknown }).runAt : 0;
  return typeof v === 'number' ? v : 0;
}

/** account_delete_request: `{ name }` → `{ runAt }`. */
export function rpcAccountDeleteRequest(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  if (!ctx.userId) throw fail(ErrorCode.BAD_REQUEST, 'no user', UNAUTHENTICATED);
  const req = parseDeleteRequest(payload);
  if (!req) throw fail(ErrorCode.BAD_REQUEST, 'bad request', INVALID_ARGUMENT);
  const username = nk.accountGetId(ctx.userId).user.username;
  if (!nameMatches(req.name, username)) throw fail(ErrorCode.BAD_REQUEST, 'name does not match', INVALID_ARGUMENT);
  let runAt = readRunAt(nk, ctx.userId);
  if (runAt === 0) {
    runAt = runAtOf(Date.now(), ACCOUNT_DELETE);
    nk.storageWrite([{ collection: QUEUE, key: ctx.userId, userId: SYSTEM_USER, value: { runAt }, permissionRead: READ_NONE, permissionWrite: WRITE_NONE }]);
  }
  return JSON.stringify({ runAt });
}

/** account_delete_cancel: `{}` → `{ ok: true }`. */
export function rpcAccountDeleteCancel(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  if (!ctx.userId) throw fail(ErrorCode.BAD_REQUEST, 'no user', UNAUTHENTICATED);
  nk.storageDelete([{ collection: QUEUE, key: ctx.userId, userId: SYSTEM_USER }]);
  return JSON.stringify({ ok: true });
}

/** account_delete_status: `{}` → `{ pending, runAt }`. */
export function rpcAccountDeleteStatus(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  if (!ctx.userId) throw fail(ErrorCode.BAD_REQUEST, 'no user', UNAUTHENTICATED);
  const runAt = readRunAt(nk, ctx.userId);
  return JSON.stringify({ pending: runAt > 0, runAt });
}

/** A login cancels a pending deletion. True if there was one. */
export function cancelPendingDeletion(nk: nkruntime.Nakama, userId: string): boolean {
  if (readRunAt(nk, userId) === 0) return false;
  nk.storageDelete([{ collection: QUEUE, key: userId, userId: SYSTEM_USER }]);
  nk.notificationSend(userId, 'deletion_cancelled', {}, NOTIFY_DELETION_CANCELLED, null, true);
  return true;
}

/** Why this account may not exist yet: a login method or its name was recently deleted. */
export function blockedReason(nk: nkruntime.Nakama, acct: AccountIds & { user: { username: string } }, now: number): string | null {
  const reqs: nkruntime.StorageReadRequest[] = loginIds(acct).map((l) => ({ collection: LOGIN_BLOCK, key: loginKey(l.provider, l.id), userId: SYSTEM_USER }));
  for (const o of reqs.length > 0 ? nk.storageRead(reqs) : []) if (isBlocked(o.value, now)) return ErrorCode.ACCOUNT_RECENTLY_DELETED;
  return nameBlockedReason(nk, acct.user.username, now);
}

/** NAME_RESERVED if a recently deleted account held this name. */
export function nameBlockedReason(nk: nkruntime.Nakama, username: string, now: number): string | null {
  if (!username) return null;
  const objs = nk.storageRead([{ collection: NAME_RESERVE, key: nameKey(username), userId: SYSTEM_USER }]);
  return objs.length > 0 && isBlocked(objs[0].value, now) ? ErrorCode.NAME_RESERVED : null;
}

/** Deletes one account for good and leaves the blocks. Returns false if it could not be done now. */
function deleteAccount(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, now: number): boolean {
  let acct: nkruntime.Account;
  try {
    acct = nk.accountGetId(userId);
  } catch (_e) {
    // Gone already: only the queue entry is left.
    nk.storageDelete([{ collection: QUEUE, key: userId, userId: SYSTEM_USER }]);
    return true;
  }
  const blocks = (collection: string, key: string, ms: number): nkruntime.StorageWriteRequest => ({
    collection,
    key,
    userId: SYSTEM_USER,
    value: { until: now + ms },
    permissionRead: READ_NONE,
    permissionWrite: WRITE_NONE,
  });
  const writes = loginIds(acct as unknown as AccountIds).map((l) => blocks(LOGIN_BLOCK, loginKey(l.provider, l.id), ACCOUNT_DELETE.loginBlockMs));
  if (acct.user.username) writes.push(blocks(NAME_RESERVE, nameKey(acct.user.username), ACCOUNT_DELETE.nameBlockMs));
  try {
    nk.storageWrite(writes);
    nk.accountDeleteId(userId, false);
    nk.storageDelete([{ collection: QUEUE, key: userId, userId: SYSTEM_USER }]);
    return true;
  } catch (e) {
    logger.error('Deleting account %s failed: %s', userId, String(e));
    return false;
  }
}

/** Deletes every due account whose owner is not in a world server. Returns how many were deleted. */
export function sweepDeletions(nk: nkruntime.Nakama, logger: nkruntime.Logger, now: number): number {
  let deleted = 0;
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 10; page++) {
    const res: nkruntime.StorageObjectList = nk.storageList(SYSTEM_USER, QUEUE, 100, cursor);
    for (const o of res.objects || []) {
      if (!isDue((o.value as { runAt?: unknown }).runAt, now)) continue;
      // Still playing on a session that outlived the request: try again at the next sweep.
      const session = readSessionDoc(nk, o.key);
      if (session.serverId !== '' && now - session.at < ACCOUNT_DELETE.staleSessionMs) continue;
      if (deleteAccount(nk, logger, o.key, now)) deleted++;
    }
    cursor = res.cursor;
    if (!cursor) break;
  }
  return deleted;
}
