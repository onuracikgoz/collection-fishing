// Profile card (docs/tasarim/10-sosyal.md 13.3): get_profile for anyone, set_profile for yourself.
import { PROFILE, SCORE, XP } from '../config';
import { getContent } from '../match/content';
import { profileWrite, readBook, readBookItems, readProfile, readXp } from '../match/playerData';
import { ErrorCode, ItemInstance, ProfileResponse, SetProfileRequest, errorMessage } from '../protocol';
import { scoreOf } from '../rules/book';
import { levelOf } from '../rules/xp';
import { checkHunting, checkShowcase, completedPages, visibleShowcase } from '../rules/profile';
import { rpcLimit } from './limit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function bad(message: string, code = 3): nkruntime.Error {
  return { message: errorMessage(ErrorCode.BAD_REQUEST, message), code } as nkruntime.Error;
}

function parse(payload: string): Record<string, unknown> {
  if (!payload) return {};
  try {
    const v = JSON.parse(payload);
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v;
  } catch (_e) {
    // fall through
  }
  throw bad('payload is not a JSON object');
}

function buildProfile(nk: nkruntime.Nakama, userId: string): ProfileResponse {
  const users = nk.usersGetId([userId]);
  if (users.length === 0) throw bad('no such user', 5);
  const entries = readBook(nk, userId);
  const doc = readProfile(nk, userId);
  const items = readBookItems(nk, userId, entries);
  const showcase: ItemInstance[] = [];
  for (const id of visibleShowcase(doc, entries)) {
    const item = items[entries[id].slot!.instanceId];
    if (item) showcase.push(item);
  }
  const res: ProfileResponse = {
    userId,
    username: users[0].username,
    score: scoreOf(entries, getContent(nk).pages, SCORE),
    pagesComplete: completedPages(entries, getContent(nk).pages),
    level: levelOf(readXp(nk, userId), XP).level,
    showcase,
  };
  if (doc.hunting) res.hunting = doc.hunting;
  return res;
}

export function rpcGetProfile(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  rpcLimit(nk, ctx.userId, 'get_profile');
  const body = parse(payload);
  let userId = ctx.userId;
  if (body.userId !== undefined) {
    if (typeof body.userId !== 'string' || !UUID.test(body.userId)) throw bad('bad userId');
    userId = body.userId;
  }
  if (!userId) throw bad('no user', 16);
  return JSON.stringify(buildProfile(nk, userId));
}

export function rpcSetProfile(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  rpcLimit(nk, ctx.userId, 'set_profile');
  if (!ctx.userId) throw bad('no user', 16);
  const body = parse(payload) as SetProfileRequest;
  const doc = readProfile(nk, ctx.userId);
  if (body.showcase !== undefined) {
    const err = checkShowcase(readBook(nk, ctx.userId), getContent(nk).pages, body.showcase, PROFILE.showcaseMax);
    if (err) throw bad(err);
    doc.showcase = body.showcase;
  }
  if (body.hunting !== undefined) {
    if (body.hunting === null) doc.hunting = undefined;
    else {
      const err = checkHunting(getContent(nk).pages, body.hunting);
      if (err) throw bad(err);
      doc.hunting = body.hunting;
    }
  }
  nk.storageWrite([profileWrite(ctx.userId, doc)]);
  return JSON.stringify(buildProfile(nk, ctx.userId));
}
