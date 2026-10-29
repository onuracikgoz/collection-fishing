// Daily quests, the streak and the chest (docs/protokol.md, Günlük görev). Pure functions, no Nakama dependency.
import { Random } from './rng';

export type QuestEvent = 'catch' | 'catch_tier' | 'sell' | 'craft' | 'merge' | 'trade' | 'emote';

const TIER_RANK: { [tier: string]: number } = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };

export interface QuestDef {
  id: string;
  event: QuestEvent;
  target: number;
  /** catch_tier: the caught item must be at least this Tier. */
  minTier?: string;
  /** Only offered to players at this level or above. */
  minLevel?: number;
}

export interface QuestConfig {
  perDay: number;
  /** A day starts at this offset from midnight UTC (the server's time zone). */
  dayOffsetMs: number;
  streakMax: number;
  /** A missed day drops the streak by this much. */
  streakFall: number;
}

export interface QuestState {
  /** Day number (see dayOf) the quests below belong to. */
  day: number;
  quests: { id: string; progress: number }[];
  /** Days in a row with a claimed chest. */
  streak: number;
  /** The day of the last claimed chest (-1 = never). */
  claimedDay: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const dayOf = (now: number, cfg: QuestConfig): number => Math.floor((now + cfg.dayOffsetMs) / DAY_MS);

/** Milliseconds until the next day starts. */
export const resetInMs = (now: number, cfg: QuestConfig): number => (dayOf(now, cfg) + 1) * DAY_MS - cfg.dayOffsetMs - now;

export const emptyQuests = (): QuestState => ({ day: -1, quests: [], streak: 0, claimedDay: -1 });

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Stored value → state, ignoring anything malformed. */
export function normalizeQuests(raw: unknown): QuestState {
  if (typeof raw !== 'object' || raw === null) return emptyQuests();
  const v = raw as Partial<QuestState>;
  const quests = Array.isArray(v.quests)
    ? v.quests.filter((q) => q && typeof q.id === 'string' && isNum(q.progress)).map((q) => ({ id: q.id, progress: Math.max(0, Math.floor(q.progress)) }))
    : [];
  return {
    day: isNum(v.day) ? v.day : -1,
    quests,
    streak: isNum(v.streak) ? Math.max(0, Math.floor(v.streak)) : 0,
    claimedDay: isNum(v.claimedDay) ? v.claimedDay : -1,
  };
}

/** Today's quests: the state as is if it is today's, else a fresh draw. A draw keeps the streak. */
export function ensureDay(state: QuestState, now: number, defs: QuestDef[], cfg: QuestConfig, level: number, random: Random): QuestState {
  const day = dayOf(now, cfg);
  if (state.day === day && state.quests.length > 0) return state;
  const pool = defs.filter((d) => (d.minLevel || 0) <= level);
  const picked: { id: string; progress: number }[] = [];
  while (picked.length < cfg.perDay && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    picked.push({ id: pool[i].id, progress: 0 });
    pool.splice(i, 1);
  }
  return { ...state, day, quests: picked };
}

export interface QuestHappened {
  event: QuestEvent;
  /** The Tier of what was caught (catch). */
  tier?: string;
  count?: number;
}

/** Adds an event to the matching quests (capped at the target). `changed` is false when nothing moved. */
export function applyQuestEvent(state: QuestState, defs: QuestDef[], ev: QuestHappened): { state: QuestState; changed: boolean } {
  const count = ev.count === undefined ? 1 : ev.count;
  let changed = false;
  const quests = state.quests.map((q) => {
    const def = defs.filter((d) => d.id === q.id)[0];
    if (!def || q.progress >= def.target) return q;
    const matches =
      (def.event === ev.event && def.event !== 'catch_tier') ||
      (def.event === 'catch_tier' && ev.event === 'catch' && ev.tier !== undefined && (TIER_RANK[ev.tier] ?? -1) >= (TIER_RANK[def.minTier || 'common'] ?? 0));
    if (!matches || count <= 0) return q;
    changed = true;
    return { id: q.id, progress: Math.min(def.target, q.progress + count) };
  });
  return changed ? { state: { ...state, quests }, changed } : { state, changed };
}

export function questsDone(state: QuestState, defs: QuestDef[]): boolean {
  if (state.quests.length === 0) return false;
  return state.quests.every((q) => {
    const def = defs.filter((d) => d.id === q.id)[0];
    return !!def && q.progress >= def.target;
  });
}

/** The streak today's chest would be for: +1 after yesterday's claim, a fall and +1 after a missed day, 1 at the start. */
export function claimStreak(state: QuestState, day: number, cfg: QuestConfig): number {
  if (state.claimedDay < 0) return 1;
  if (state.claimedDay >= day) return state.streak;
  if (state.claimedDay === day - 1) return Math.min(cfg.streakMax, state.streak + 1);
  return Math.min(cfg.streakMax, Math.max(0, state.streak - cfg.streakFall) + 1);
}

export type ClaimPlan = { ok: true; streak: number; state: QuestState } | { ok: false; reason: 'NOT_DONE' | 'ALREADY_CLAIMED' };

/** Whether today's chest can be claimed, and the state after it. */
export function planClaim(state: QuestState, defs: QuestDef[], now: number, cfg: QuestConfig): ClaimPlan {
  const day = dayOf(now, cfg);
  if (state.claimedDay === day) return { ok: false, reason: 'ALREADY_CLAIMED' };
  if (state.day !== day || !questsDone(state, defs)) return { ok: false, reason: 'NOT_DONE' };
  const streak = claimStreak(state, day, cfg);
  return { ok: true, streak, state: { ...state, streak, claimedDay: day } };
}

export interface ChestPoolEntry {
  weight: number;
  defId: string;
  count: number;
}

/** What one streak day's chest holds. Ranges are inclusive. */
export interface ChestDef {
  coin: [number, number];
  dust: [number, number];
  /** Random stacks: `rolls` draws from `pool` by weight. */
  rolls: number;
  pool: ChestPoolEntry[];
  /** Always in the chest. */
  guaranteed: { defId: string; count: number }[];
}

export interface Reward {
  kind: 'coin' | 'dust' | 'stack';
  /** Empty for coin and dust. */
  defId: string;
  count: number;
}

const between = (range: [number, number], random: Random): number => range[0] + Math.floor(random() * (range[1] - range[0] + 1));

/** The chest for a streak day (1-based; past the end uses the last). */
export function rollChest(chests: ChestDef[], streak: number, random: Random): Reward[] {
  const def = chests[Math.min(chests.length, Math.max(1, streak)) - 1];
  const out: Reward[] = [];
  const coin = between(def.coin, random);
  if (coin > 0) out.push({ kind: 'coin', defId: '', count: coin });
  const dust = between(def.dust, random);
  if (dust > 0) out.push({ kind: 'dust', defId: '', count: dust });
  const total = def.pool.reduce((a, e) => a + Math.max(0, e.weight), 0);
  for (let i = 0; i < def.rolls && total > 0; i++) {
    let roll = random() * total;
    for (const e of def.pool) {
      roll -= Math.max(0, e.weight);
      if (roll < 0) {
        out.push({ kind: 'stack', defId: e.defId, count: e.count });
        break;
      }
    }
  }
  for (const g of def.guaranteed) out.push({ kind: 'stack', defId: g.defId, count: g.count });
  return mergeRewards(out);
}

/** Same kind and defId add up. */
export function mergeRewards(list: Reward[]): Reward[] {
  const out: Reward[] = [];
  for (const r of list) {
    const same = out.filter((o) => o.kind === r.kind && o.defId === r.defId)[0];
    if (same) same.count += r.count;
    else out.push({ ...r });
  }
  return out;
}
