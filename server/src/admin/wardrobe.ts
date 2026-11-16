// Admin panel wardrobe RPCs (docs/araclar/admin-paneli.md Gardırop): find a player, see their
// wardrobe, give or take an item. Server-to-server only (http_key), like admin/rpc.ts.
import { WARDROBE } from '../config';
import { ErrorCode, errorMessage } from '../protocol';
import { WARDROBE_SOURCES, WardrobeSource, makeItem, removeItem } from '../rules/wardrobe';
import { getContent } from '../match/content';
import { findWorldMatches } from '../match/servers';
import { readSession } from '../match/playerData';
import { NOTIFY_WARDROBE, readWardrobe, updateWardrobe } from '../match/wardrobe';
import { wardrobeResponse } from '../rpc/wardrobe';

type Body = { [k: string]: unknown };
const fail = (code: string, message: string, grpc = 3): nkruntime.Error => ({ message: errorMessage(code, message), code: grpc }) as nkruntime.Error;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adminOnly(ctx: nkruntime.Context): void {
  if (ctx.userId) throw fail(ErrorCode.NOT_ALLOWED, 'admin RPCs need the server http_key, not a player session', 7);
}

function parse(payload: string): Body {
  let v: unknown;
  try {
    v = JSON.parse(payload || '{}');
  } catch (_e) {
    throw fail(ErrorCode.BAD_REQUEST, 'payload is not JSON');
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw fail(ErrorCode.BAD_REQUEST, 'payload must be an object');
  return v as Body;
}

/** The user by id or by username. */
function findUser(nk: nkruntime.Nakama, q: unknown): nkruntime.User {
  if (typeof q !== 'string' || q.trim() === '') throw fail(ErrorCode.BAD_REQUEST, 'player id or name is required');
  const s = q.trim();
  const users = UUID_RE.test(s) ? nk.usersGetId([s]) : nk.usersGetUsername([s]);
  if (users.length === 0) throw fail(ErrorCode.NOT_FOUND, 'no such player', 5);
  return users[0];
}

/** Tells the player's client and their world match that the wardrobe changed. */
function announce(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string): void {
  try {
    nk.notificationSend(userId, 'wardrobe', {}, NOTIFY_WARDROBE, null, true);
  } catch (e) {
    logger.warn('wardrobe notification to %s failed: %s', userId, String(e));
  }
  const serverId = readSession(nk, userId);
  const m = serverId ? findWorldMatches(nk)[serverId] : undefined;
  if (!m) return;
  try {
    nk.matchSignal(m.matchId, JSON.stringify({ type: 'wardrobe_refresh', userId }));
  } catch (e) {
    logger.warn('wardrobe_refresh to %s failed: %s', serverId, String(e));
  }
}

/** `{ player }` (id or username) → `{ userId, username, items, look, worn }`. */
export function rpcAdminWardrobeGet(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const u = findUser(nk, parse(payload).player);
  const { doc } = readWardrobe(nk, u.userId);
  return JSON.stringify({ userId: u.userId, username: u.username, ...wardrobeResponse(getContent(nk, logger), doc, u.userId, Date.now()) });
}

/** `{ player, part, color, color2?, days?, locked? }`: adds one item to the player's wardrobe. */
export function rpcAdminWardrobeGive(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  const u = findUser(nk, body.player);
  const w = getContent(nk, logger).wardrobe;
  const source: WardrobeSource = WARDROBE_SOURCES.indexOf(body.source as WardrobeSource) >= 0 ? (body.source as WardrobeSource) : 'admin';
  const days = body.days === undefined || body.days === null || body.days === 0 ? undefined : Number(body.days);
  const item = makeItem(
    w,
    {
      part: String(body.part || ''),
      color: typeof body.color === 'string' ? body.color : '',
      color2: typeof body.color2 === 'string' && body.color2 !== '' ? body.color2 : undefined,
      days,
      locked: body.locked === true,
      source,
    },
    nk.uuidv4(),
    Date.now(),
    WARDROBE.maxGiveDays,
  );
  if (typeof item === 'string') throw fail(ErrorCode.BAD_REQUEST, item);
  updateWardrobe(nk, u.userId, (d) => {
    if (d.items.length >= WARDROBE.maxItems) throw fail(ErrorCode.NOT_ALLOWED, `wardrobe is full (${WARDROBE.maxItems})`, 9);
    return { items: d.items.concat([item]), look: d.look };
  });
  announce(nk, logger, u.userId);
  logger.info('admin_wardrobe_give %s to %s', item.part, u.userId);
  return JSON.stringify({ ok: true, item });
}

/** `{ player, instanceId }`: removes one item; if it is worn the player's server takes it off now. */
export function rpcAdminWardrobeTake(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  adminOnly(ctx);
  const body = parse(payload);
  const u = findUser(nk, body.player);
  const id = body.instanceId;
  if (typeof id !== 'string' || id === '') throw fail(ErrorCode.BAD_REQUEST, 'instanceId is required');
  let found = false;
  updateWardrobe(nk, u.userId, (d) => {
    const next = removeItem(d, id);
    found = next !== null;
    return next;
  });
  if (!found) throw fail(ErrorCode.NOT_FOUND, 'the player has no such item', 5);
  announce(nk, logger, u.userId);
  logger.info('admin_wardrobe_take %s from %s', id, u.userId);
  return JSON.stringify({ ok: true });
}
