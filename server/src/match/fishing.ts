// Fishing inside the world match. Decisions come from rules/; this file only
// moves messages, timers and storage around (docs/protokol.md, Balık tutma).
import { QuestState } from '../rules/quest';
import { trackQuest } from './quest';
import { ANNOUNCE, BAG, BAIT, BOOK_LUCK, CATCH_TABLE, ENERGY, FISHING, FLOAT_TABLE, REEL_PARAMS, ROD, XP } from '../config';
import { BOOK_PAGES } from '../data/book-pages';
import { LAKE_POOL } from '../data/lake-pool';
import { AnnounceMsg, BobberMsg, BobberState, FishEndMsg, FishOutcome, ItemInstance, OpCode, ReelStartMsg } from '../protocol';
import { BagSummary } from '../rules/bag';
import { shouldAnnounce } from '../rules/announce';
import { applyBait, baitDef, baitTagBoost } from '../rules/bait';
import { Rod, isBroken, rodView, wearRod } from '../rules/rod';
import { BookEntries, applyLuck, luckOf } from '../rules/book';
import { rollCatch, rollFloat } from '../rules/catch';
import { spendCast } from '../rules/energy';
import { FishState, checkBait, checkCast, hookWindow, judgeReel, onHook, parseCast, planWait, reelTimedOut } from '../rules/fishing';
import { parseInputs, simulateReel } from '../rules/reel';
import { WaterMap } from '../rules/water';
import { placeNewItem } from './items';
import { addXp, xpForCatch } from '../rules/xp';
import { energyWrite, rodWrite, stacksWrite, xpWrite } from './playerData';

/** The part of a match player that fishing needs. */
export interface Fisher {
  presence: nkruntime.Presence;
  move: { x: number; y: number };
  energy: number;
  bag: BagSummary;
  book: BookEntries;
  rod: Rod;
  /** Total XP. */
  xp: number;
  fish?: FishState;
  lastCatch?: string;
  /** Today's quests; absent until loaded at join. */
  quest?: QuestState;
}

export interface FishingContext {
  nk: nkruntime.Nakama;
  logger: nkruntime.Logger;
  dispatcher: nkruntime.MatchDispatcher;
  water: WaterMap;
  /** Everyone who should see this fisher's bobber, including the fisher. */
  audience: (f: Fisher) => nkruntime.Presence[];
  /** Everyone in this server, for announcements. */
  everyone: () => nkruntime.Presence[];
}

function send(ctx: FishingContext, op: number, body: unknown, to: nkruntime.Presence[]): void {
  if (to.length > 0) ctx.dispatcher.broadcastMessage(op, JSON.stringify(body), to, null, true);
}

function bobber(ctx: FishingContext, f: Fisher, state: BobberState): void {
  const fs = f.fish!;
  const msg: BobberMsg = { id: f.presence.userId, x: fs.x, y: fs.y, band: fs.band, state };
  if (state !== 'cast') return send(ctx, OpCode.BOBBER, msg, ctx.audience(f));
  // The fisher's own cast message also carries the new energy and the bait left.
  const own: BobberMsg = { ...msg, energy: f.energy };
  if (fs.bait) own.bait = { defId: fs.bait, count: f.bag.stacks[fs.bait] || 0 };
  send(ctx, OpCode.BOBBER, own, [f.presence]);
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


export function handleCast(ctx: FishingContext, f: Fisher, body: unknown, now: number): void {
  const target = parseCast(body);
  if (!target) return;
  const check = checkCast(ctx.water, f.move, target, !!f.fish, f.bag, BAG, FISHING);
  if (!check.ok) {
    // BUSY must not end the fishing already in progress.
    if (check.reason === 'BUSY') return send(ctx, OpCode.FISH_END, { id: f.presence.userId, outcome: 'rejected', reason: 'BUSY', energy: f.energy }, [f.presence]);
    return end(ctx, f, 'rejected', { reason: check.reason });
  }
  // A broken rod fishes like a cast without energy: no energy spent, junk only.
  const broken = isBroken(f.rod);
  const spent = broken ? { value: f.energy, hasEnergy: false } : spendCast(f.energy, ENERGY);
  if (target.bait) {
    const b = checkBait(target.bait, !!baitDef(target.bait, BAIT), f.bag.stacks, spent.hasEnergy, broken);
    if (!b.ok) return end(ctx, f, 'rejected', { reason: b.reason });
  }
  const writes: nkruntime.StorageWriteRequest[] = [];
  const stacks = { ...f.bag.stacks };
  if (spent.hasEnergy) writes.push(energyWrite(f.presence.userId, spent.value, true));
  if (target.bait) {
    // One special bait per cast, gone whatever happens next (03-balik-tutma.md 5.0.0.1).
    if (stacks[target.bait] > 1) stacks[target.bait]--;
    else delete stacks[target.bait];
    writes.push(stacksWrite(f.presence.userId, stacks));
  }
  if (writes.length > 0) {
    try {
      ctx.nk.storageWrite(writes);
    } catch (e) {
      ctx.logger.error('Saving cast failed: %s', String(e));
      // The bait must not be lost without a cast; energy alone is safe to keep in memory.
      if (target.bait) return end(ctx, f, 'rejected', { reason: 'NO_BAIT' });
    }
  }
  f.energy = spent.value;
  f.bag.stacks = stacks;
  const wait = planWait(now, FISHING, Math.random);
  f.fish = {
    phase: 'waiting',
    x: target.x,
    y: target.y,
    band: check.band,
    hasEnergy: spent.hasEnergy,
    bait: target.bait,
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
  // Catches with energy wear the rod; a broken rod's casts never have energy.
  const rod = f.fish!.hasEnergy ? wearRod(f.rod, ROD) : null;
  if (rod) {
    writes.push(rodWrite(userId, rod));
    extra.rod = rodView(rod, ROD);
  }
  let announce: AnnounceMsg | undefined;
  if (roll.tier) {
    const fl = rollFloat(FLOAT_TABLE, Math.random);
    const item: ItemInstance = {
      instanceId: ctx.nk.uuidv4(),
      defId: roll.def.id,
      tier: roll.tier,
      float: fl.value,
      source: 'fishing',
      obtainedAt: Date.now(),
    };
    const placed = placeNewItem(userId, f.book, item);
    writes.push(...placed.writes);
    book = placed.book;
    if (placed.msg) extra.book = placed.msg;
    extra.item = item;
    if (shouldAnnounce(roll.tier, ANNOUNCE.minTier)) {
      announce = { kind: 'rare_catch', id: userId, name: f.presence.username, defId: roll.def.id, tier: roll.tier, condition: fl.condition };
    }
  } else {
    const stacks = { ...f.bag.stacks };
    stacks[roll.def.id] = (stacks[roll.def.id] || 0) + 1;
    writes.push(stacksWrite(userId, stacks));
    extra.stack = { defId: roll.def.id, count: stacks[roll.def.id] };
  }
  const xpResult = addXp(f.xp, xpForCatch(roll.def.category, f.fish!.hasEnergy, XP), XP);
  if (xpResult.gain.gained > 0) writes.push(xpWrite(userId, xpResult.total));
  try {
    ctx.nk.storageWrite(writes);
  } catch (e) {
    ctx.logger.error('Saving catch failed: %s', String(e));
    return end(ctx, f, 'escaped');
  }
  if (book) f.book = book;
  else if (extra.item) f.bag.items++;
  if (rod) f.rod = rod;
  if (extra.stack) f.bag.stacks[extra.stack.defId] = extra.stack.count;
  f.lastCatch = roll.def.id;
  f.xp = xpResult.total;
  extra.xpGain = xpResult.gain;
  end(ctx, f, 'caught', extra);
  trackQuest(ctx.nk, ctx.logger, ctx.dispatcher, f, { event: 'catch', tier: roll.tier || undefined });
  if (announce) send(ctx, OpCode.ANNOUNCE, announce, ctx.everyone());
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
      const bait = fs.bait ? baitDef(fs.bait, BAIT) : null;
      const table = applyBait(applyLuck(CATCH_TABLE, luckOf(f.book, BOOK_PAGES, BOOK_LUCK), BOOK_LUCK), bait, fs.band);
      const roll = rollCatch(LAKE_POOL, table, fs.band, fs.hasEnergy, Math.random, baitTagBoost(bait, fs.band));
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
