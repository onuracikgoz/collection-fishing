// Wardrobe in the world match and RPCs (docs/protokol.md Gardırop). Storage: player/wardrobe,
// written only by the server, with version checks because the admin panel writes it too.
import { WARDROBE } from '../config';
import { LookShowMsg, OpCode } from '../protocol';
import { CompiledWardrobe, LookView, StoredLook, WardrobeDoc, applyLookSet, asWardrobeDoc, currentLook, lookView, nextExpiry, pruneExpired } from '../rules/wardrobe';
import { getContent } from './content';

const READ_OWNER = 1 as nkruntime.ReadPermissionValues;
const WRITE_SERVER = 0 as nkruntime.WritePermissionValues;
export const WARDROBE_KEY = 'wardrobe';
export const NOTIFY_WARDROBE = 120;

export function readWardrobe(nk: nkruntime.Nakama, userId: string): { doc: WardrobeDoc; version: string } {
  const objs = nk.storageRead([{ collection: 'player', key: WARDROBE_KEY, userId }]);
  if (objs.length === 0) return { doc: { items: [], look: null }, version: '' };
  return { doc: asWardrobeDoc(objs[0].value), version: objs[0].version };
}

function writeWardrobe(nk: nkruntime.Nakama, userId: string, doc: WardrobeDoc, version: string): void {
  // '*' = only if nothing is stored yet.
  nk.storageWrite([{ collection: 'player', key: WARDROBE_KEY, userId, value: doc as unknown as { [k: string]: unknown }, version: version || '*', permissionRead: READ_OWNER, permissionWrite: WRITE_SERVER }]);
}

/**
 * Read, change, write with the storage version; retried when someone else wrote between.
 * `change` returns the new doc, or null to write nothing. Returns the doc as it now stands.
 */
export function updateWardrobe(nk: nkruntime.Nakama, userId: string, change: (doc: WardrobeDoc) => WardrobeDoc | null): WardrobeDoc {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    const cur = readWardrobe(nk, userId);
    const next = change(cur.doc);
    if (next === null) return cur.doc;
    try {
      writeWardrobe(nk, userId, next, cur.version);
      return next;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** What a player in the match keeps about their look. */
export interface Wearer {
  presence: nkruntime.Presence;
  visible: { [id: string]: true };
  look: StoredLook;
  lookView: LookView;
  /** Earliest end of a worn rental (wall ms), 0 = none. */
  lookExpiry: number;
  lastLookAt?: number;
}

/** The look to wear now; expired rentals are dropped from storage on the way. */
export function loadLook(nk: nkruntime.Nakama, logger: nkruntime.Logger, w: CompiledWardrobe, userId: string, now: number): { look: StoredLook; view: LookView; expiry: number } {
  let doc: WardrobeDoc | null = null;
  try {
    doc = updateWardrobe(nk, userId, (d) => pruneExpired(d, now));
  } catch (e) {
    logger.error('Reading wardrobe of %s failed: %s', userId, String(e));
  }
  const look = currentLook(w, doc, userId, now);
  return { look, view: lookView(look, doc), expiry: nextExpiry(doc, look) };
}

function seers(players: { [id: string]: Wearer }, p: Wearer): nkruntime.Presence[] {
  const to = [p.presence];
  for (const id in players) if (id !== p.presence.userId && players[id].visible[p.presence.userId]) to.push(players[id].presence);
  return to;
}

function show(dispatcher: nkruntime.MatchDispatcher, to: nkruntime.Presence[], msg: LookShowMsg): void {
  dispatcher.broadcastMessage(OpCode.LOOK_SHOW, JSON.stringify(msg), to, null, true);
}

/** LOOK_SET: the whole outfit. Refusals go only to the player, with the look they still wear. */
export function handleLookSet(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  players: { [id: string]: Wearer },
  p: Wearer,
  body: unknown,
  now: number,
  wall = Date.now(),
): void {
  const id = p.presence.userId;
  const refuse = (reason: string) => show(dispatcher, [p.presence], { id, look: p.lookView, reason });
  if (p.lastLookAt !== undefined && now - p.lastLookAt < WARDROBE.lookCooldownMs) return refuse('RATE_LIMITED');
  p.lastLookAt = now;
  const w = getContent(nk, logger).wardrobe;
  let saved: WardrobeDoc | null = null;
  let reason = '';
  try {
    saved = updateWardrobe(nk, id, (d) => {
      const r = applyLookSet(w, body, d.items, wall);
      if ('reason' in r) {
        reason = r.reason;
        return null;
      }
      reason = '';
      return { items: d.items, look: r.look };
    });
  } catch (e) {
    logger.error('Saving look of %s failed: %s', id, String(e));
    return refuse('BAD_LOOK');
  }
  if (reason) return refuse(reason);
  const look = currentLook(w, saved, id, wall);
  p.look = look;
  p.lookView = lookView(look, saved);
  p.lookExpiry = nextExpiry(saved, look);
  show(dispatcher, seers(players, p), { id, look: p.lookView });
}

/** Re-reads the player's wardrobe (rental ended, admin gave or took) and shows a changed look. */
export function refreshLook(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, players: { [id: string]: Wearer }, p: Wearer, wall = Date.now()): void {
  const w = getContent(nk, logger).wardrobe;
  const next = loadLook(nk, logger, w, p.presence.userId, wall);
  const changed = JSON.stringify(next.view) !== JSON.stringify(p.lookView);
  p.look = next.look;
  p.lookView = next.view;
  p.lookExpiry = next.expiry;
  if (changed) show(dispatcher, seers(players, p), { id: p.presence.userId, look: p.lookView });
}

/** Every tick: players whose worn rental just ended. Cheap, it only compares numbers. */
export function tickLooks(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, players: { [id: string]: Wearer }, wall = Date.now()): void {
  for (const id in players) {
    const p = players[id];
    if (p.lookExpiry > 0 && wall >= p.lookExpiry) refreshLook(nk, logger, dispatcher, players, p, wall);
  }
}
