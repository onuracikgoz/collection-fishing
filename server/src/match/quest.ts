// Daily quests inside the world match (docs/protokol.md, Günlük görev). Rules are in rules/quest.ts.
// The match keeps each player's quest state; every change is written to storage and pushed to the player.
import { BAG, QUESTS_CONFIG, XP } from '../config';
import { CHESTS, QUESTS } from '../data/quests';
import { OpCode, QuestClaimResultMsg, QuestStateMsg } from '../protocol';
import { slotsUsed } from '../rules/bag';
import { QuestHappened, QuestState, claimStreak, dayOf, ensureDay, applyQuestEvent, planClaim, questsDone, resetInMs, rollChest } from '../rules/quest';
import { levelOf } from '../rules/xp';
import { Fisher } from './fishing';
import { questWrite, readQuests, readWallet, stacksWrite } from './playerData';

const cfg = QUESTS_CONFIG;

function send(dispatcher: nkruntime.MatchDispatcher, op: number, body: unknown, p: Fisher): void {
  dispatcher.broadcastMessage(op, JSON.stringify(body), [p.presence], null, true);
}

function view(state: QuestState, now: number): QuestStateMsg {
  const day = dayOf(now, cfg);
  return {
    day: state.day,
    quests: state.quests.map((q) => {
      const def = QUESTS.filter((d) => d.id === q.id)[0];
      return { id: q.id, event: def ? def.event : '', progress: q.progress, target: def ? def.target : 0 };
    }),
    complete: questsDone(state, QUESTS),
    claimed: state.claimedDay === day,
    streak: state.streak,
    chestDay: claimStreak(state, day, cfg),
    resetInMs: resetInMs(now, cfg),
  };
}

/** Loads the quest state at join: today's quests, drawn and saved if the day is new. */
export function loadQuestState(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, xp: number, now: number): QuestState {
  const stored = readQuests(nk, userId);
  const state = ensureDay(stored, now, QUESTS, cfg, levelOf(xp, XP).level, Math.random);
  if (state !== stored) save(nk, logger, userId, state);
  return state;
}

function save(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, state: QuestState): void {
  try {
    nk.storageWrite([questWrite(userId, state)]);
  } catch (e) {
    logger.error('Saving quests of %s failed: %s', userId, String(e));
  }
}

export function sendQuests(dispatcher: nkruntime.MatchDispatcher, p: Fisher, now: number): void {
  if (p.quest) send(dispatcher, OpCode.QUEST_STATE, view(p.quest, now), p);
}

/** Counts something the player did. Does nothing for a player without quest state. */
export function trackQuest(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  dispatcher: nkruntime.MatchDispatcher,
  p: Fisher,
  ev: QuestHappened,
  now: number = Date.now(),
): void {
  if (!p.quest) return;
  const today = ensureDay(p.quest, now, QUESTS, cfg, levelOf(p.xp, XP).level, Math.random);
  const res = applyQuestEvent(today, QUESTS, ev);
  if (!res.changed && today === p.quest) return;
  p.quest = res.state;
  save(nk, logger, p.presence.userId, p.quest);
  sendQuests(dispatcher, p, now);
}

/** Each tick: a player who stays online past midnight gets the new day's quests. */
export function rollQuestDay(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, p: Fisher, now: number): void {
  if (!p.quest || p.quest.day === dayOf(now, cfg)) return;
  p.quest = ensureDay(p.quest, now, QUESTS, cfg, levelOf(p.xp, XP).level, Math.random);
  save(nk, logger, p.presence.userId, p.quest);
  sendQuests(dispatcher, p, now);
}

/** QUEST_CLAIM: opens today's chest once all quests are done. One transaction: state, stacks, Coin and dust. */
export function handleQuestClaim(nk: nkruntime.Nakama, logger: nkruntime.Logger, dispatcher: nkruntime.MatchDispatcher, p: Fisher, now: number = Date.now()): void {
  const userId = p.presence.userId;
  const reply = (msg: QuestClaimResultMsg) => send(dispatcher, OpCode.QUEST_CLAIM_RESULT, msg, p);
  if (!p.quest) return reply({ ok: false, reason: 'ERROR' });
  const plan = planClaim(p.quest, QUESTS, now, cfg);
  if (!plan.ok) return reply({ ok: false, reason: plan.reason });

  const rewards = rollChest(CHESTS, plan.streak, Math.random);
  const stacks = { ...p.bag.stacks };
  let coin = 0;
  let dust = 0;
  for (const r of rewards) {
    if (r.kind === 'coin') coin += r.count;
    else if (r.kind === 'dust') dust += r.count;
    else stacks[r.defId] = (stacks[r.defId] || 0) + r.count;
  }
  if (slotsUsed({ items: p.bag.items, stacks }, BAG) > BAG.slots) return reply({ ok: false, reason: 'BAG_FULL' });

  const writes = [questWrite(userId, plan.state)];
  if (rewards.some((r) => r.kind === 'stack')) writes.push(stacksWrite(userId, stacks));
  const changeset: { [k: string]: number } = {};
  if (coin > 0) changeset.coin = coin;
  if (dust > 0) changeset.dust = dust;
  let wallet = readWallet(nk, userId);
  try {
    const res = nk.multiUpdate(null, writes, [], Object.keys(changeset).length > 0 ? [{ userId, changeset, metadata: { action: 'quest_chest', streak: plan.streak } }] : []);
    if (res.walletUpdateAcks.length > 0) {
      const w = res.walletUpdateAcks[0].updated;
      wallet = { coin: w.coin || 0, dust: w.dust || 0, diamond: w.diamond || 0 };
    }
  } catch (e) {
    logger.error('Quest chest of %s failed: %s', userId, String(e));
    return reply({ ok: false, reason: 'ERROR' });
  }
  p.quest = plan.state;
  p.bag.stacks = stacks;
  reply({ ok: true, streak: plan.streak, chestDay: plan.streak, rewards, coin: wallet.coin, dust: wallet.dust });
  sendQuests(dispatcher, p, now);
}
