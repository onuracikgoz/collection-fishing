// Account transfer code (docs/protokol.md, Giriş). A web account makes a one-time code;
// Steam redeems it with its ticket and gets linked to that account, no web approval.
// The code is the approval, so it is short-lived, single-use, and wrong guesses are throttled per address.
import { TRANSFER } from '../config';
import { tradeLockWrite } from '../match/playerData';
import { ErrorCode, errorMessage } from '../protocol';
import { CodeRecord, formatCode, generateCode, isLive, parseRedeem, recent, underLimit } from '../rules/transfer';
import { rpcLimit } from './limit';

// gRPC codes (nkruntime.Codes)
const INVALID_ARGUMENT = 3;
const NOT_FOUND = 5;
const RESOURCE_EXHAUSTED = 8;
const FAILED_PRECONDITION = 9;
const UNAUTHENTICATED = 16;

const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';
const HOUR_MS = 60 * 60 * 1000;
/** Notification code shown on the next login: a login method was linked. */
export const NOTIFY_LINKED = 101;
/** Notification code: a login method was removed. */
export const NOTIFY_UNLINKED = 102;

const fail = (code: string, message: string, grpc: number): nkruntime.Error => ({ message: errorMessage(code, message), code: grpc } as nkruntime.Error);

const READ_NONE = 0 as nkruntime.ReadPermissionValues;
const WRITE_NONE = 0 as nkruntime.WritePermissionValues;

function codeWrite(code: string, rec: CodeRecord, mustBeNew: boolean): nkruntime.StorageWriteRequest {
  const w: nkruntime.StorageWriteRequest = { collection: 'transfer', key: code, userId: SYSTEM_USER, value: rec, permissionRead: READ_NONE, permissionWrite: WRITE_NONE };
  if (mustBeNew) w.version = '*';
  return w;
}

interface ActiveDoc {
  code: string | null;
  times: number[];
}

function readActive(nk: nkruntime.Nakama, userId: string): ActiveDoc {
  const objs = nk.storageRead([{ collection: 'transfer_user', key: 'active', userId }]);
  const v = objs.length > 0 ? (objs[0].value as Partial<ActiveDoc>) : {};
  return { code: typeof v.code === 'string' ? v.code : null, times: Array.isArray(v.times) ? v.times.filter((t) => typeof t === 'number') : [] };
}

const activeWrite = (userId: string, doc: ActiveDoc): nkruntime.StorageWriteRequest => ({
  collection: 'transfer_user',
  key: 'active',
  userId,
  value: doc,
  permissionRead: READ_NONE,
  permissionWrite: WRITE_NONE,
});

/** Random bytes for a code; uuidv4 comes from a secure source. */
function randomBytes(nk: nkruntime.Nakama, count: number): number[] {
  const out: number[] = [];
  while (out.length < count) {
    const hex = nk.uuidv4().replace(/-/g, '');
    for (let i = 0; i + 1 < hex.length && out.length < count; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  }
  return out;
}

/** transfer_code_create: `{}` → `{ code, expiresInMs }`. Needs a session. One live code per account. */
export function rpcTransferCodeCreate(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  rpcLimit(nk, ctx.userId, 'transfer_code_create');
  if (!ctx.userId) throw fail(ErrorCode.BAD_REQUEST, 'no user', UNAUTHENTICATED);
  const userId = ctx.userId;
  const now = Date.now();
  const doc = readActive(nk, userId);
  const times = recent(doc.times, now, HOUR_MS);
  if (times.length >= TRANSFER.createPerHour) throw fail(ErrorCode.RATE_LIMITED, 'too many codes', RESOURCE_EXHAUSTED);
  if (doc.code) {
    try {
      nk.storageDelete([{ collection: 'transfer', key: doc.code, userId: SYSTEM_USER }]);
    } catch (e) {
      logger.warn('Old transfer code not removed: %s', String(e));
    }
  }
  let code = '';
  for (let attempt = 0; attempt < 5 && code === ''; attempt++) {
    const candidate = generateCode(randomBytes(nk, TRANSFER.codeLength), TRANSFER.codeLength);
    try {
      nk.storageWrite([codeWrite(candidate, { owner: userId, expiresAt: now + TRANSFER.ttlMs }, true)]);
      code = candidate;
    } catch (_e) {
      // The code exists already (version '*'): draw again.
    }
  }
  if (code === '') throw fail(ErrorCode.BAD_REQUEST, 'could not make a code', FAILED_PRECONDITION);
  times.push(now);
  nk.storageWrite([activeWrite(userId, { code, times })]);
  return JSON.stringify({ code: formatCode(code), expiresInMs: TRANSFER.ttlMs });
}

const failKey = (ip: string) => 'ip_' + ip.replace(/[^A-Za-z0-9]/g, '_').slice(0, 60);

/**
 * transfer_code_redeem: `{ code, steamToken }` → `{ ok: true }`. Called without a session (HTTP key):
 * the Steam player has no account yet. On success Steam is linked to the web account and the client
 * then logs in with `authenticateSteam(create: false)`.
 */
export function rpcTransferCodeRedeem(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const req = parseRedeem(payload, TRANSFER.codeLength);
  if (!req) throw fail(ErrorCode.BAD_REQUEST, 'bad request', INVALID_ARGUMENT);
  const now = Date.now();
  const fkey = failKey(ctx.clientIp || 'unknown');
  const failObj = nk.storageRead([{ collection: 'transfer_fail', key: fkey, userId: SYSTEM_USER }]);
  const failTimes: number[] = failObj.length > 0 && Array.isArray((failObj[0].value as { times?: number[] }).times) ? (failObj[0].value as { times: number[] }).times : [];
  if (!underLimit(failTimes, now, TRANSFER.failWindowMs, TRANSFER.maxFails)) throw fail(ErrorCode.RATE_LIMITED, 'too many wrong codes', RESOURCE_EXHAUSTED);
  const wrong = (): nkruntime.Error => {
    nk.storageWrite([{ collection: 'transfer_fail', key: fkey, userId: SYSTEM_USER, value: { times: recent(failTimes, now, TRANSFER.failWindowMs).concat([now]) }, permissionRead: READ_NONE, permissionWrite: WRITE_NONE }]);
    return fail('CODE_INVALID', 'code is wrong, used or expired', NOT_FOUND);
  };

  const objs = nk.storageRead([{ collection: 'transfer', key: req.code, userId: SYSTEM_USER }]);
  if (objs.length === 0 || !isLive(objs[0].value, now)) throw wrong();
  const rec = objs[0].value as CodeRecord;
  // Single use: take the code first; with the version check a second redeem at the same moment fails here.
  try {
    nk.storageDelete([{ collection: 'transfer', key: req.code, userId: SYSTEM_USER, version: objs[0].version }]);
  } catch (_e) {
    throw wrong();
  }
  const owner = rec.owner;
  try {
    const username = nk.accountGetId(owner).user.username;
    nk.linkSteam(owner, username, req.steamToken, false);
  } catch (e) {
    // The ticket was refused or Steam is linked elsewhere: give the code back so a retry works.
    logger.warn('Steam link for transfer code failed: %s', String(e));
    try {
      nk.storageWrite([codeWrite(req.code, rec, false)]);
    } catch (_e) {
      // Out of luck: the player makes a new code.
    }
    wrong();
    throw fail('LINK_FAILED', 'could not link Steam', FAILED_PRECONDITION);
  }
  try {
    nk.storageWrite([tradeLockWrite(owner, now + TRANSFER.steamTradeLockMs), activeWrite(owner, { code: null, times: recent(readActive(nk, owner).times, now, HOUR_MS) })]);
    nk.notificationSend(owner, 'login_linked', { provider: 'steam' }, NOTIFY_LINKED, null, true);
  } catch (e) {
    logger.error('Steam linked but the trade lock or notice failed for %s: %s', owner, String(e));
  }
  return JSON.stringify({ ok: true });
}
