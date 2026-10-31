// Daily quests: rules (days, events, streak, chest) and the match side against a fake Nakama.
import { describe, expect, it } from 'vitest';
import { BAG, QUESTS_CONFIG, XP } from '../src/config';
import { CHESTS, QUESTS } from '../src/data/quests';
import { OpCode } from '../src/protocol';
import { QuestDef, applyQuestEvent, claimStreak, dayOf, emptyQuests, ensureDay, normalizeQuests, planClaim, questsDone, resetInMs, rollChest } from '../src/rules/quest';
import { seededRandom } from '../src/rules/rng';
import { totalForLevel } from '../src/rules/xp';
import { handleQuestClaim, loadQuestState, rollQuestDay, trackQuest } from '../src/match/quest';

const cfg = QUESTS_CONFIG;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 12:00 Turkey time on some day.
const noon = (d: number) => d * DAY - cfg.dayOffsetMs + 12 * HOUR;
const defs: QuestDef[] = [
  { id: 'a', event: 'catch', target: 2 },
  { id: 'b', event: 'catch_tier', target: 1, minTier: 'rare' },
  { id: 'c', event: 'sell', target: 3 },
  { id: 'hi', event: 'trade', target: 1, minLevel: 10 },
];

describe('days', () => {
  it('starts a day at midnight Turkey time', () => {
    const midnight = 20000 * DAY - cfg.dayOffsetMs;
    expect(dayOf(midnight - 1, cfg)).toBe(19999);
    expect(dayOf(midnight, cfg)).toBe(20000);
    expect(resetInMs(midnight, cfg)).toBe(DAY);
    expect(resetInMs(midnight + HOUR, cfg)).toBe(23 * HOUR);
  });
});

describe('drawing quests', () => {
  it('draws distinct quests the player has the level for, once a day', () => {
    const low = ensureDay(emptyQuests(), noon(10), defs, { ...cfg, perDay: 3 }, 1, seededRandom(1));
    expect(low.quests.length).toBe(3);
    expect(new Set(low.quests.map((q) => q.id)).size).toBe(3);
    expect(low.quests.some((q) => q.id === 'hi')).toBe(false);
    expect(low.day).toBe(10);
    expect(ensureDay(low, noon(10) + HOUR, defs, cfg, 1, seededRandom(2))).toBe(low);
    const next = ensureDay(low, noon(11), defs, cfg, 20, seededRandom(3));
    expect(next.day).toBe(11);
    expect(next.quests.every((q) => q.progress === 0)).toBe(true);
  });

  it('keeps the streak and last claim across days, and draws what exists when the pool is small', () => {
    const state = { ...emptyQuests(), streak: 4, claimedDay: 9 };
    const next = ensureDay(state, noon(10), defs.slice(0, 2), cfg, 1, seededRandom(4));
    expect(next.streak).toBe(4);
    expect(next.claimedDay).toBe(9);
    expect(next.quests.length).toBe(2);
  });

  it('reads stored data defensively', () => {
    expect(normalizeQuests(null)).toEqual(emptyQuests());
    expect(normalizeQuests({ day: 'x', quests: [{ id: 5 }, { id: 'a', progress: 2.7 }], streak: -3, claimedDay: 4 })).toEqual({ day: -1, quests: [{ id: 'a', progress: 2 }], streak: 0, claimedDay: 4 });
  });
});

describe('events', () => {
  const start = { day: 1, quests: [{ id: 'a', progress: 0 }, { id: 'b', progress: 0 }, { id: 'c', progress: 0 }], streak: 0, claimedDay: -1 };

  it('counts matching events up to the target', () => {
    let s = applyQuestEvent(start, defs, { event: 'catch', tier: 'common' });
    expect(s.changed).toBe(true);
    expect(s.state.quests.map((q) => q.progress)).toEqual([1, 0, 0]);
    s = applyQuestEvent(s.state, defs, { event: 'catch' });
    s = applyQuestEvent(s.state, defs, { event: 'catch' });
    expect(s.state.quests[0].progress).toBe(2);
    expect(s.changed).toBe(false);
    s = applyQuestEvent(s.state, defs, { event: 'sell', count: 5 });
    expect(s.state.quests[2].progress).toBe(3);
  });

  it('catch_tier needs a Tier at least as good, and no Tier (a stack) never counts', () => {
    expect(applyQuestEvent(start, defs, { event: 'catch', tier: 'common' }).state.quests[1].progress).toBe(0);
    expect(applyQuestEvent(start, defs, { event: 'catch' }).state.quests[1].progress).toBe(0);
    expect(applyQuestEvent(start, defs, { event: 'catch', tier: 'rare' }).state.quests[1].progress).toBe(1);
    expect(applyQuestEvent(start, defs, { event: 'catch', tier: 'mythic' }).state.quests[1].progress).toBe(1);
  });

  it('ignores events nobody asked for, zero counts and unknown quests', () => {
    expect(applyQuestEvent(start, defs, { event: 'emote' }).changed).toBe(false);
    expect(applyQuestEvent(start, defs, { event: 'sell', count: 0 }).changed).toBe(false);
    expect(applyQuestEvent({ ...start, quests: [{ id: 'gone', progress: 0 }] }, defs, { event: 'catch' }).changed).toBe(false);
  });

  it('is done only when every quest is at its target', () => {
    const done = { ...start, quests: [{ id: 'a', progress: 2 }, { id: 'b', progress: 1 }, { id: 'c', progress: 3 }] };
    expect(questsDone(done, defs)).toBe(true);
    expect(questsDone(start, defs)).toBe(false);
    expect(questsDone(emptyQuests(), defs)).toBe(false);
  });

  it('counts a quest taken out of the list (admin panel) as done', () => {
    const done = { ...start, quests: [{ id: 'a', progress: 2 }, { id: 'gone', progress: 0 }] };
    expect(questsDone(done, defs)).toBe(true);
  });
});

describe('streak and claim', () => {
  const done = (day: number, streak: number, claimedDay: number) => ({ day, quests: [{ id: 'a', progress: 2 }], streak, claimedDay });
  const one: QuestDef[] = [{ id: 'a', event: 'catch', target: 2 }];

  it('starts at 1, grows by a day, falls after a missed day, and stops at 10', () => {
    expect(claimStreak(emptyQuests(), 5, cfg)).toBe(1);
    expect(claimStreak({ ...emptyQuests(), streak: 3, claimedDay: 4 }, 5, cfg)).toBe(4);
    expect(claimStreak({ ...emptyQuests(), streak: 9, claimedDay: 4 }, 5, cfg)).toBe(10);
    expect(claimStreak({ ...emptyQuests(), streak: 10, claimedDay: 4 }, 5, cfg)).toBe(10);
    // Missed a day: 7 → 4, then +1.
    expect(claimStreak({ ...emptyQuests(), streak: 7, claimedDay: 3 }, 5, cfg)).toBe(5);
    expect(claimStreak({ ...emptyQuests(), streak: 2, claimedDay: 1 }, 5, cfg)).toBe(1);
  });

  it('claims once a day and only when done', () => {
    const now = noon(5);
    const ok = planClaim(done(5, 3, 4), one, now, cfg);
    expect(ok).toMatchObject({ ok: true, streak: 4 });
    if (ok.ok) expect(ok.state).toMatchObject({ streak: 4, claimedDay: 5 });
    expect(planClaim(done(5, 3, 5), one, now, cfg)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(planClaim({ ...done(5, 3, 4), quests: [{ id: 'a', progress: 1 }] }, one, now, cfg)).toEqual({ ok: false, reason: 'NOT_DONE' });
    expect(planClaim(done(4, 3, 3), one, now, cfg)).toEqual({ ok: false, reason: 'NOT_DONE' });
  });
});

describe('chest', () => {
  it('has a chest for each streak day, getting better, and day 10 holds the Good recipe', () => {
    expect(CHESTS.length).toBe(cfg.streakMax);
    expect(CHESTS[9].guaranteed.map((g) => g.defId)).toContain('recipe.pike_trophy');
    expect(CHESTS[9].coin[0]).toBeGreaterThan(CHESTS[0].coin[1]);
    for (let i = 1; i < CHESTS.length; i++) expect(CHESTS[i].coin[0]).toBeGreaterThanOrEqual(CHESTS[i - 1].coin[0]);
  });

  it('rolls inside the ranges, always gives the guaranteed things and merges equal stacks', () => {
    for (let seed = 1; seed < 30; seed++) {
      const r = rollChest(CHESTS, 10, seededRandom(seed));
      const coin = r.filter((x) => x.kind === 'coin')[0];
      expect(coin.count).toBeGreaterThanOrEqual(CHESTS[9].coin[0]);
      expect(coin.count).toBeLessThanOrEqual(CHESTS[9].coin[1]);
      expect(r.filter((x) => x.defId === 'recipe.pike_trophy')[0].count).toBe(1);
      expect(new Set(r.map((x) => x.kind + x.defId)).size).toBe(r.length);
    }
    expect(rollChest(CHESTS, 99, seededRandom(1)).length).toBeGreaterThan(0);
    expect(rollChest(CHESTS, 0, seededRandom(1))[0].kind).toBe('coin');
    // Day 1 has no dust.
    expect(rollChest(CHESTS, 1, seededRandom(1)).some((x) => x.kind === 'dust')).toBe(false);
  });

  it('only gives things that exist', () => {
    const known = new Set(['lake.mat.scale', 'lake.mat.moss', 'bait.shiny', 'bait.crystal', 'recipe.scale_charm', 'recipe.moss_wreath', 'recipe.pike_trophy', 'recipe.shiny_bait']);
    for (const c of CHESTS) for (const e of [...c.pool, ...c.guaranteed]) expect(known.has(e.defId)).toBe(true);
    expect(QUESTS.every((q) => q.target > 0)).toBe(true);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
  });
});

// --- match side ---

function world() {
  const store = new Map<string, any>();
  const wallets: { [id: string]: { coin: number; dust: number } } = {};
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const sent: { op: number; body: any }[] = [];
  const nk: any = {
    storageRead: (reqs: any[]) => reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)) })),
    storageWrite: (writes: any[]) => writes.forEach((w) => store.set(key(w.collection, w.key, w.userId), w.value)),
    accountGetId: (id: string) => ({ wallet: wallets[id] || {} }),
    multiUpdate: (_a: unknown, writes: any[], _d: any[], wal: any[]) => {
      for (const w of writes) store.set(key(w.collection, w.key, w.userId), w.value);
      const acks = wal.map((w) => {
        const cur = wallets[w.userId] || { coin: 0, dust: 0 };
        wallets[w.userId] = { coin: cur.coin + (w.changeset.coin || 0), dust: cur.dust + (w.changeset.dust || 0) };
        return { userId: w.userId, updated: { ...wallets[w.userId] } };
      });
      return { walletUpdateAcks: acks };
    },
  };
  const dispatcher: any = { broadcastMessage: (op: number, data: string) => sent.push({ op, body: JSON.parse(data) }) };
  const logger: any = { error: () => undefined };
  const player = (level = 1): any => ({ presence: { userId: 'u1', sessionId: 's', username: 'u1', node: 'n' }, xp: totalForLevel(level, XP), bag: { items: 0, stacks: {} }, quest: undefined });
  const last = (op: number) => sent.filter((m) => m.op === op).slice(-1)[0];
  return { store, wallets, sent, nk, dispatcher, logger, player, last, key };
}

describe('quests in the match', () => {
  it('draws and saves today at join, and every counted event saves and pushes the state', () => {
    const w = world();
    const p = w.player();
    const now = noon(30);
    p.quest = loadQuestState(w.nk, w.logger, 'u1', p.xp, now);
    expect(p.quest.quests.length).toBe(3);
    expect(w.store.get(w.key('quest', 'daily', 'u1')).day).toBe(30);
    const def = QUESTS.filter((d) => d.id === p.quest.quests[0].id)[0];
    // Feed enough events of every kind that the three quests need.
    for (const ev of ['catch', 'sell', 'craft', 'merge', 'emote', 'trade'] as const) {
      for (let i = 0; i < 12; i++) trackQuest(w.nk, w.logger, w.dispatcher, p, { event: ev, tier: 'epic' }, now);
    }
    expect(def).toBeDefined();
    const msg = w.last(OpCode.QUEST_STATE).body;
    expect(msg.complete).toBe(true);
    expect(msg.quests.every((q: any) => q.progress === q.target)).toBe(true);
    expect(w.store.get(w.key('quest', 'daily', 'u1')).quests.length).toBe(3);
    // Nothing changed: nothing sent.
    const before = w.sent.length;
    trackQuest(w.nk, w.logger, w.dispatcher, p, { event: 'catch' }, now);
    expect(w.sent.length).toBe(before);
  });

  it('claims the chest once: state, stacks, Coin and dust in one go', () => {
    const w = world();
    const p = w.player();
    const now = noon(40);
    p.quest = { day: 40, quests: [{ id: 'catch_5', progress: 5 }, { id: 'sell_5', progress: 5 }, { id: 'emote_3', progress: 3 }], streak: 0, claimedDay: -1 };
    w.wallets.u1 = { coin: 10, dust: 1 };
    handleQuestClaim(w.nk, w.logger, w.dispatcher, p, now);
    const res = w.last(OpCode.QUEST_CLAIM_RESULT).body;
    expect(res).toMatchObject({ ok: true, streak: 1, chestDay: 1 });
    const coin = res.rewards.filter((r: any) => r.kind === 'coin')[0].count;
    expect(coin).toBeGreaterThanOrEqual(CHESTS[0].coin[0]);
    expect(res.coin).toBe(10 + coin);
    expect(w.wallets.u1.coin).toBe(10 + coin);
    for (const r of res.rewards.filter((x: any) => x.kind === 'stack')) expect(p.bag.stacks[r.defId]).toBeGreaterThanOrEqual(r.count);
    expect(w.store.get(w.key('quest', 'daily', 'u1'))).toMatchObject({ streak: 1, claimedDay: 40 });
    expect(w.last(OpCode.QUEST_STATE).body).toMatchObject({ claimed: true, streak: 1 });
    handleQuestClaim(w.nk, w.logger, w.dispatcher, p, now);
    expect(w.last(OpCode.QUEST_CLAIM_RESULT).body).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(w.wallets.u1.coin).toBe(10 + coin);
  });

  it('refuses an unfinished day, and a full bag leaves the claim for later', () => {
    const w = world();
    const p = w.player();
    const now = noon(41);
    p.quest = { day: 41, quests: [{ id: 'catch_5', progress: 4 }], streak: 0, claimedDay: -1 };
    handleQuestClaim(w.nk, w.logger, w.dispatcher, p, now);
    expect(w.last(OpCode.QUEST_CLAIM_RESULT).body.reason).toBe('NOT_DONE');
    p.quest.quests[0].progress = 5;
    p.bag = { items: BAG.slots, stacks: {} };
    // Day 10's chest always has stacks, so it cannot fit.
    p.quest = { ...p.quest, streak: 9, claimedDay: 40 };
    handleQuestClaim(w.nk, w.logger, w.dispatcher, p, now);
    expect(w.last(OpCode.QUEST_CLAIM_RESULT).body.reason).toBe('BAG_FULL');
    expect(p.quest.claimedDay).toBe(40);
    expect(w.store.has(w.key('quest', 'daily', 'u1'))).toBe(false);
  });

  it('draws new quests when the player is online past midnight', () => {
    const w = world();
    const p = w.player();
    p.quest = loadQuestState(w.nk, w.logger, 'u1', p.xp, noon(50));
    const first = p.quest;
    rollQuestDay(w.nk, w.logger, w.dispatcher, p, noon(50) + HOUR);
    expect(p.quest).toBe(first);
    rollQuestDay(w.nk, w.logger, w.dispatcher, p, noon(51));
    expect(p.quest.day).toBe(51);
    expect(w.last(OpCode.QUEST_STATE).body.day).toBe(51);
  });

  it('does nothing for a player without quest state', () => {
    const w = world();
    const p = w.player();
    trackQuest(w.nk, w.logger, w.dispatcher, p, { event: 'catch' });
    expect(w.sent.length).toBe(0);
  });
});
