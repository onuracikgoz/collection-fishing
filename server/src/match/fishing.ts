// Fishing inside the world match. Decisions come from rules/; this file only
// moves messages, timers and storage around (docs/protokol.md, Balık tutma).
import { BAG, BOOK_LUCK, CATCH_TABLE, ENERGY, FISHING, FLOAT_TABLE, REEL_PARAMS, SCORE } from '../config';
import { BOOK_PAGES } from '../data/book-pages';
import { LAKE_POOL } from '../data/lake-pool';
import { BobberMsg, BobberState, FishEndMsg, FishOutcome, ItemInstance, OpCode, ReelStartMsg } from '../protocol';
import { BagSummary } from '../rules/bag';
import { BookEntries, applyLuck, discover, luckOf, onCatch, scoreOf } from '../rules/book';
import { rollCatch, rollFloat } from '../rules/catch';
import { spendCast } from '../rules/energy';
import { FishState, checkCast, hookWindow, judgeReel, onHook, parseCast, planWait, reelTimedOut } from '../rules/fishing';
import { parseInputs, simulateReel } from '../rules/reel';
import { WaterMap } from '../rules/water';
import { StoredItem, bookWrite, energyWrite, itemWrite, stacksWrite } from './playerData';

/** The part of a match player that fishing needs. */
export interface Fisher {
  presence: nkruntime.Presence;
  move: { x: number; y: number };
  energy: number;
  bag: BagSummary;
  book: BookEntries;
  fish?: FishState;
}

export interface FishingContext {
  nk: nkruntime.Nakama;
  logger: nkruntime.Logger;
  dispatcher: nkruntime.MatchDispatcher;
  water: WaterMap;
  /** Everyone who should see this fisher's bobber, including the fisher. */
  audience: (f: Fisher) => nkruntime.Presence[];
}

function send(ctx: FishingContext, op: number, body: unknown, to: nkruntime.Presence[]): void {
  if (to.length > 0) ctx.dispatcher.broadcastMessage(op, JSON.stringify(body), to, null, true);
}

function bobber(ctx: FishingContext, f: Fisher, state: BobberState): void {
  const fs = f.fish!;
  const msg: BobberMsg = { id: f.presence.userId, x: fs.x, y: fs.y, band: fs.band, state };
  if (state !== 'cast') return send(ctx, OpCode.BOBBER, msg, ctx.audience(f));
  // The fisher's own cast message also carries the new energy.
  send(ctx, OpCode.BOBBER, { ...msg, energy: f.energy }, [f.presence]);
  send(ctx, OpCode.BOBBER, msg, ctx.audience(f).filter((p) => p.sessionId !== f.presence.sessionId));
}

/** Ends fishing: everyone nearby learns the outcome, the fisher gets the details. */
function end(ctx: FishingContext, f: Fisher, outcome: FishOutcome, extra: Partial<FishEndMsg> = {}): void {
  const id = f.presence.userId;
  const defId = outcome === 'caught' ? extra.defId : undefined;
  const others = ctx.audience(f).filter((p) => p.sessionId !== f.presence.sessionId);
  // A refused cast never showed a bobber, so only the fisher hears about it.
  if (f.fish) send(ctx, OpCode.FISH_END, defId ? { id, outcome, defId } : { id, outcome }, others);
  const own: FishEndMsg = { id, outcome, energy: f.energy, ...extra };
  send(ctx, OpCode.FISH_END, own, [f.presence]);
  f.fish = undefined;
}

function saveEnergy(ctx: FishingContext, f: Fisher): void {
  try {
    ctx.nk.storageWrite([energyWrite(f.presence.userId, f.energy, true)]);
  } catch (e) {
    ctx.logger.error('Saving energy failed: %s', String(e));
  }
}

export function handleCast(ctx: FishingContext, f: Fisher, body: unknown, now: number): void {
  const target = parseCast(body);
  if (!target) return;
  const check = checkCast(ctx.water, f.move, target, !!f.fish, f.bag, BAG, FISHING);
  if (!check.ok) {
    // BUSY must not end the fishing already in progress.
    if (check.reason === 'BUSY') return send(ctx, OpCode.FISH_END, { id: f.presence.userId, outcome: 'rejected', reason: 'BUSY', energy: f.energy }, [f.presence]);
    return end(ctx, f, 'rejected', { reason: check.reason });
  }
  const spent = spendCast(f.energy, ENERGY);
  if (spent.hasEnergy) {
    f.energy = spent.value;
    saveEnergy(ctx, f);
  }
  const wait = planWait(now, FISHING, Math.random);
  f.fish = {
    phase: 'waiting',
    x: target.x,
    y: target.y,
    band: check.band,
    hasEnergy: spent.hasEnergy,
    biteAt: wait.biteAt,
    twitches: wait.twitches,
    hookDeadline: 0,
  };
  bobber(ctx, f, 'cast');
}

export function handleHook(ctx: FishingContext, f: Fisher, now: number): void {
  if (!f.fish) return;
  const action = onHook(f.fish, now);
  if (action === 'missed') return end(ctx, f, 'missed');
  if (action !== 'reel') return;
  const fs = f.fish;
  const params = REEL_PARAMS[fs.roll!.tier || 'common'];
  fs.phase = 'reeling';
  fs.seed = Math.floor(Math.random() * 4294967296);
  fs.params = params;
  fs.reelStartAt = now;
  const msg: ReelStartMsg = { seed: fs.seed, params };
  send(ctx, OpCode.REEL_START, msg, [f.presence]);
}

export function handleReelDone(ctx: FishingContext, f: Fisher, body: unknown, now: number): void {
  const fs = f.fish;
  if (!fs || fs.phase !== 'reeling' || !fs.params || fs.seed === undefined) return;
  const inputs = parseInputs(body, fs.params.maxMs);
  if (!inputs) return end(ctx, f, 'escaped');
  const result = simulateReel(fs.seed, fs.params, inputs);
  if (judgeReel(fs, result, now, FISHING) === 'escaped') return end(ctx, f, 'escaped');
  give(ctx, f);
}

export function cancelFishing(ctx: FishingContext, f: Fisher): void {
  if (f.fish) end(ctx, f, 'cancelled');
}

/** Puts the catch in the bag and tells everyone. */
function give(ctx: FishingContext, f: Fisher): void {
  const roll = f.fish!.roll!;
  const userId = f.presence.userId;
  const writes: nkruntime.StorageWriteRequest[] = [];
  const extra: Partial<FishEndMsg> = { defId: roll.def.id };
  let book: BookEntries | null = null;
  if (roll.tier) {
    const item: ItemInstance = {
      instanceId: ctx.nk.uuidv4(),
      defId: roll.def.id,
      tier: roll.tier,
      float: rollFloat(FLOAT_TABLE, Math.random).value,
      source: 'fishing',
      obtainedAt: Date.now(),
    };
    const where = onCatch(f.book, BOOK_PAGES, item.defId, item.float);
    if (where.kind === 'discovered') {
      // First copy goes straight to its slot: recorded and not in the bag.
      book = discover(f.book, item.defId, { instanceId: item.instanceId, tier: item.tier, float: item.float }, item.obtainedAt);
      const stored: StoredItem = { ...item, inBook: true };
      writes.push(itemWrite(userId, stored), bookWrite(userId, book));
      extra.book = {
        page: where.page,
        kind: 'discovered',
        pageComplete: where.pageComplete,
        luck: luckOf(book, BOOK_PAGES, BOOK_LUCK),
        score: scoreOf(book, BOOK_PAGES, SCORE),
      };
    } else {
      writes.push(itemWrite(userId, item));
      if (where.kind === 'copy') extra.book = { page: where.page, kind: 'copy', better: where.better };
    }
    extra.item = item;
  } else {
    const stacks = { ...f.bag.stacks };
    stacks[roll.def.id] = (stacks[roll.def.id] || 0) + 1;
    writes.push(stacksWrite(userId, stacks));
    extra.stack = { defId: roll.def.id, count: stacks[roll.def.id] };
  }
  try {
    ctx.nk.storageWrite(writes);
  } catch (e) {
    ctx.logger.error('Saving catch failed: %s', String(e));
    return end(ctx, f, 'escaped');
  }
  if (book) f.book = book;
  else if (extra.item) f.bag.items++;
  if (extra.stack) f.bag.stacks[extra.stack.defId] = extra.stack.count;
  end(ctx, f, 'caught', extra);
}

/** Runs timers once per tick: twitches, the bite, missed hooks and reel timeouts. */
export function tickFishing(ctx: FishingContext, f: Fisher, now: number): void {
  const fs = f.fish;
  if (!fs) return;
  if (fs.phase === 'waiting') {
    while (fs.twitches.length > 0 && fs.twitches[0] <= now) {
      fs.twitches.shift();
      bobber(ctx, f, 'twitch');
    }
    if (now >= fs.biteAt) {
      const table = applyLuck(CATCH_TABLE, luckOf(f.book, BOOK_PAGES, BOOK_LUCK), BOOK_LUCK);
      const roll = rollCatch(LAKE_POOL, table, fs.band, fs.hasEnergy, Math.random);
      if (!roll) return end(ctx, f, 'escaped');
      fs.roll = roll;
      fs.phase = 'bite';
      fs.hookDeadline = now + hookWindow(roll, FISHING) + FISHING.hookGraceMs;
      bobber(ctx, f, 'bite');
    }
  } else if (fs.phase === 'bite') {
    if (now > fs.hookDeadline) end(ctx, f, 'missed');
  } else if (reelTimedOut(fs, now, FISHING)) {
    end(ctx, f, 'escaped');
  }
}
