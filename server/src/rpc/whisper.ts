// Whisper, its setting and player reports (docs/protokol.md, Fısıltı). Whispers go to the receiver as
// a live (not stored) Nakama notification, so they reach them on any server and never sit in storage.
import { ACCOUNT_DELETE, REPORTS, WHISPER, XP } from '../config';
import { areFriends } from '../match/friends';
import { readMutedUntil, readSessionDoc, readStall, readXp } from '../match/playerData';
import { ErrorCode, errorMessage } from '../protocol';
import { recent, underLimit } from '../rules/transfer';
import { maskPersonal, parseReport, parseWhisper, whisperRefusal } from '../rules/whisper';
import { levelOf } from '../rules/xp';
import { rpcLimit } from './limit';

const INVALID_ARGUMENT = 3;
const NOT_FOUND = 5;
const PERMISSION_DENIED = 7;
const RESOURCE_EXHAUSTED = 8;
const FAILED_PRECONDITION = 9;
const UNAUTHENTICATED = 16;
const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';
/** Notification code of a whisper. */
export const NOTIFY_WHISPER = 110;

const READ_OWNER = 1 as nkruntime.ReadPermissionValues;
const READ_NONE = 0 as nkruntime.ReadPermissionValues;
const WRITE_NONE = 0 as nkruntime.WritePermissionValues;

const fail = (code: string, message: string, grpc: number): nkruntime.Error => ({ message: errorMessage(code, message), code: grpc } as nkruntime.Error);

function readDoc(nk: nkruntime.Nakama, collection: string, key: string, userId: string): Record<string, unknown> | null {
  const objs = nk.storageRead([{ collection, key, userId }]);
  return objs.length > 0 ? (objs[0].value as Record<string, unknown>) : null;
}

/** `player/settings.pmOff`: whispers from strangers turned off ("PM kapalı"). */
export function readPmOff(nk: nkruntime.Nakama, userId: string): boolean {
  const v = readDoc(nk, 'player', 'settings', userId);
  return !!(v && v.pmOff === true);
}

/** True if `userId` has blocked `otherId` (Nakama friend state 3). */
export function hasBlocked(nk: nkruntime.Nakama, userId: string, otherId: string): boolean {
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 10; page++) {
    const res: nkruntime.FriendList = nk.friendsList(userId, 100, 3, cursor);
    for (const f of res.friends || []) if (f.user && f.user.userId === otherId) return true;
    cursor = res.cursor;
    if (!cursor) break;
  }
  return false;
}

function takeRate(nk: nkruntime.Nakama, key: string, userId: string, now: number, windowMs: number, max: number): boolean {
  const v = readDoc(nk, 'player', key, userId);
  const times = v && Array.isArray(v.times) ? (v.times as unknown[]).filter((t): t is number => typeof t === 'number') : [];
  if (!underLimit(times, now, windowMs, max)) return false;
  nk.storageWrite([{ collection: 'player', key, userId, value: { times: recent(times, now, windowMs).concat([now]) }, permissionRead: READ_NONE, permissionWrite: WRITE_NONE }]);
  return true;
}

/**
 * whisper_send: `{ userId | username, text, context? }` → `{ ok, to, toName, text, masked }`.
 * `text` in the answer is what the receiver got (personal info masked).
 */
export function rpcWhisperSend(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  rpcLimit(nk, ctx.userId, 'whisper_send');
  if (!ctx.userId) throw fail(ErrorCode.BAD_REQUEST, 'no user', UNAUTHENTICATED);
  const from = ctx.userId;
  const req = parseWhisper(payload);
  if (!req) throw fail(ErrorCode.BAD_REQUEST, 'bad request', INVALID_ARGUMENT);
  const now = Date.now();
  if (readMutedUntil(nk, from) > now) throw fail(ErrorCode.MUTED, 'you are muted', PERMISSION_DENIED);

  const users = req.byName ? nk.usersGetUsername([req.to]) : nk.usersGetId([req.to]);
  const target = users.length > 0 ? users[0] : null;
  if (!target) throw fail(ErrorCode.NOT_FOUND, 'no such player', NOT_FOUND);
  if (target.userId === from) throw fail(ErrorCode.SELF, 'cannot whisper yourself', INVALID_ARGUMENT);
  const to = target.userId;

  const stall = req.context === 'stall' ? readStall(nk, to) : null;
  const refusal = whisperRefusal(
    {
      friends: areFriends(nk, from, to),
      blockedBySender: hasBlocked(nk, from, to),
      blockedByTarget: hasBlocked(nk, to, from),
      targetPmOff: readPmOff(nk, to),
      targetHasStall: !!stall && !stall.ended,
      senderLevel: levelOf(readXp(nk, from), XP).level,
      context: req.context,
    },
    WHISPER,
  );
  if (refusal) throw fail(refusal, 'not allowed', PERMISSION_DENIED);

  const session = readSessionDoc(nk, to);
  if (session.serverId === '' || now - session.at >= ACCOUNT_DELETE.staleSessionMs) throw fail(ErrorCode.OFFLINE, 'player is not online', FAILED_PRECONDITION);

  const clean = maskPersonal(req.text, WHISPER);
  const fromName = ctx.username || nk.usersGetId([from])[0].username;
  nk.notificationSend(to, 'whisper', { from, fromName, text: clean.text, context: req.context, at: now }, NOTIFY_WHISPER, from, false);
  return JSON.stringify({ ok: true, to, toName: target.username, text: clean.text, masked: clean.masked });
}

/** whisper_settings: `{ pmOff? }` → `{ pmOff }`. An empty body only reads. */
export function rpcWhisperSettings(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  rpcLimit(nk, ctx.userId, 'whisper_settings');
  if (!ctx.userId) throw fail(ErrorCode.BAD_REQUEST, 'no user', UNAUTHENTICATED);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(payload || '{}');
  } catch (_e) {
    throw fail(ErrorCode.BAD_REQUEST, 'bad request', INVALID_ARGUMENT);
  }
  if (body.pmOff !== undefined && typeof body.pmOff !== 'boolean') throw fail(ErrorCode.BAD_REQUEST, 'pmOff must be true or false', INVALID_ARGUMENT);
  if (typeof body.pmOff === 'boolean') {
    const doc = readDoc(nk, 'player', 'settings', ctx.userId) || {};
    nk.storageWrite([{ collection: 'player', key: 'settings', userId: ctx.userId, value: { ...doc, pmOff: body.pmOff }, permissionRead: READ_OWNER, permissionWrite: WRITE_NONE }]);
  }
  return JSON.stringify({ pmOff: readPmOff(nk, ctx.userId) });
}

/** report_player: `{ userId, reason, note?, text? }` → `{ ok: true }`. Stored for the moderators, never shown to players. */
export function rpcReportPlayer(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  if (!ctx.userId) throw fail(ErrorCode.BAD_REQUEST, 'no user', UNAUTHENTICATED);
  const req = parseReport(payload);
  if (!req) throw fail(ErrorCode.BAD_REQUEST, 'bad request', INVALID_ARGUMENT);
  if (req.userId === ctx.userId) throw fail(ErrorCode.SELF, 'cannot report yourself', INVALID_ARGUMENT);
  if (nk.usersGetId([req.userId]).length === 0) throw fail(ErrorCode.NOT_FOUND, 'no such player', NOT_FOUND);
  const now = Date.now();
  if (!takeRate(nk, 'report_rate', ctx.userId, now, REPORTS.windowMs, REPORTS.perWindow)) throw fail(ErrorCode.RATE_LIMITED, 'too many reports', RESOURCE_EXHAUSTED);
  nk.storageWrite([
    {
      collection: 'reports',
      key: `${req.userId}_${ctx.userId}_${now}`,
      userId: SYSTEM_USER,
      value: { target: req.userId, reporter: ctx.userId, reason: req.reason, note: req.note, text: req.text, at: now },
      permissionRead: READ_NONE,
      permissionWrite: WRITE_NONE,
    },
  ]);
  return JSON.stringify({ ok: true });
}
