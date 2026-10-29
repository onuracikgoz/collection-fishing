// Mirrors docs/protokol.md. Change the doc first, then this file.
export const PROTOCOL_VERSION = 1;

export const OpCode = {
  MOVE: 1,
  SNAPSHOT: 2,
  PLAYER_ENTER: 3,
  PLAYER_LEAVE: 4,
  SAY: 5,
  BUBBLE: 6,
  CORRECTION: 7,
  WELCOME: 8,
  CAST: 9,
  BOBBER: 10,
  HOOK: 11,
  REEL_START: 12,
  REEL_DONE: 13,
  FISH_END: 14,
  CANCEL: 15,
  BOOK_PLACE: 16,
  BOOK_RESULT: 17,
  GOTO_FRIEND: 18,
  TELEPORT: 19,
  EMOTE: 20,
  EMOTE_SHOW: 21,
  SELL: 22,
  SALVAGE: 23,
  ECONOMY_RESULT: 24,
  MERGE: 25,
  CRAFT: 26,
  CRAFT_RESULT: 27,
  REPAIR_ROD: 28,
  BUY_BAIT: 29,
  SHOP_RESULT: 30,
  STASH_OPEN: 31,
  STASH_PUT: 32,
  STASH_TAKE: 33,
  STASH_EXPAND: 34,
  STASH_RESULT: 35,
  EMOTE_STATUS: 36,
  EMOTE_STATUS_SHOW: 37,
  ANNOUNCE: 38,
  TRADE_OFFER: 39,
  TRADE_REPLY: 40,
  TRADE_SET: 41,
  TRADE_LOCK: 42,
  TRADE_CONFIRM: 43,
  TRADE_CANCEL: 44,
  TRADE_INVITE: 45,
  TRADE_STATE: 46,
  TRADE_END: 47,
  ITEM_LOCK: 48,
  ITEM_LOCK_RESULT: 49,
  STALL_OPEN: 50,
  STALL_RECALL: 51,
  STALL_VIEW: 52,
  STALL_BUY: 53,
  STALL_LIST: 54,
  STALL_STATE: 55,
  STALL_RESULT: 56,
  QUEST_STATE: 57,
  QUEST_CLAIM: 58,
  QUEST_CLAIM_RESULT: 59,
} as const;

export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  PROTOCOL_MISMATCH: 'PROTOCOL_MISMATCH',
  SERVER_FULL: 'SERVER_FULL',
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_RECENTLY_DELETED: 'ACCOUNT_RECENTLY_DELETED',
  NAME_RESERVED: 'NAME_RESERVED',
} as const;

export interface HealthcheckResponse {
  ok: true;
  serverTime: number;
  protocolVersion: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface ServerInfo {
  matchId: string;
  name: string;
  language: string;
  players: number;
  capacity: number;
}

export interface ListServersResponse {
  servers: ServerInfo[];
}

export interface PlayerView {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
}

export interface SnapshotMsg {
  t: number;
  players: PlayerView[];
}

export interface PlayerEnterMsg extends PlayerView {
  name: string;
  characterId: string;
  /** Present if the player is fishing right now. */
  bobber?: { x: number; y: number; band: Band };
  /** Persistent status emote, if one is worn. */
  status?: string;
}

export interface PlayerLeaveMsg {
  id: string;
}

export interface BubbleMsg {
  id: string;
  text: string;
}

export interface CorrectionMsg {
  seq: number;
  x: number;
  y: number;
}

export interface WelcomeMsg {
  you: { id: string; x: number; y: number };
  serverName: string;
  energy: number;
  energyMax: number;
  rod: RodView;
  /** Status emote worn right now. */
  status?: string;
  /** Status emotes the player owns beyond the free set. */
  emotesOwned: string[];
  /** Level and XP inside the level (xpNext 0 at the top level). */
  level: number;
  xp: number;
  xpNext: number;
}

/** The player's rod (Faz 4). */
export interface RodView {
  level: number;
  durability: number;
  max: number;
}

// --- Faz 2: fishing ---

export type Band = 'shore' | 'mid' | 'deep';
export type Tier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type BobberState = 'cast' | 'twitch' | 'bite';
export type FishOutcome = 'caught' | 'escaped' | 'missed' | 'cancelled' | 'rejected';

export interface BobberMsg {
  id: string;
  x: number;
  y: number;
  band: Band;
  state: BobberState;
  /** Only in the fisher's own `cast` message: energy after the cast. */
  energy?: number;
  /** Only in the fisher's own `cast` message: the special bait used and how many are left. */
  bait?: { defId: string; count: number };
}

export interface ReelStartMsg {
  seed: number;
  params: {
    barSize: number;
    lift: number;
    gravity: number;
    maxVel: number;
    fishSpeed: number;
    retargetSteps: number;
    gain: number;
    loss: number;
    maxSteps: number;
    maxMs: number;
  };
}

export interface ItemInstance {
  instanceId: string;
  defId: string;
  tier: Tier;
  float: number;
  source: 'fishing' | 'craft' | 'merge' | 'trade';
  /** Protected by its owner: cannot be sold, salvaged, merged, crafted or traded. */
  locked?: true;
  obtainedAt: number;
}

export interface FishEndMsg {
  id: string;
  outcome: FishOutcome;
  /** What was caught, for everyone who sees it. */
  defId?: string;
  // The rest only goes to the fisher.
  reason?: string;
  item?: ItemInstance;
  stack?: { defId: string; count: number };
  energy?: number;
  /** Book outcome for a Tier item on a book page. */
  book?: FishBookMsg;
  /** The rod after this catch, when it wore. */
  rod?: RodView;
  /** XP for this catch and where the player stands now. */
  xpGain?: XpGainMsg;
}

export interface XpGainMsg {
  gained: number;
  level: number;
  xp: number;
  xpNext: number;
  /** Set when this catch reached a new level. */
  levelUp?: { level: number; unlocks: string[] };
}

export interface FishBookMsg {
  page: string;
  /** discovered: first copy, recorded and placed in its slot (not in the bag). copy: went to the bag. */
  kind: 'discovered' | 'copy';
  /** discovered: this record completed its page. */
  pageComplete?: boolean;
  /** copy: cleaner than the slot's copy, or the slot is empty ("Defterdekiyle değiştir?"). */
  better?: boolean;
  /** discovered: new values. */
  luck?: number;
  score?: number;
}

export interface BookPlaceMsg {
  instanceId: string;
}

export interface BookResultMsg {
  ok: boolean;
  /** NOT_OWNED, NOT_IN_BOOK, NOT_FOUND, BAD_REQUEST */
  reason?: string;
  defId?: string;
  page?: string;
  /** Now in the slot. */
  slot?: ItemInstance;
  /** Was in the slot, now in the bag. */
  previous?: ItemInstance;
  score?: number;
}

export type RecordState = 'unknown' | 'found' | 'filled';

export interface BookRecordMsg {
  /** Missing for unknown records. */
  defId?: string;
  state: RecordState;
  item?: ItemInstance;
}

export interface BookResponse {
  userId: string;
  pages: { id: string; total: number; found: number; filled: number; records: BookRecordMsg[] }[];
  luck: number;
  score: number;
}

export interface InventoryResponse {
  energy: number;
  energyMax: number;
  slotsUsed: number;
  slotsMax: number;
  items: ItemInstance[];
  stacks: { defId: string; count: number }[];
  coin: number;
  dust: number;
  rod: RodView;
}

/** Reply to SELL and SALVAGE, only to the player. */
export interface EconomyResultMsg {
  action: 'sell' | 'salvage';
  ok: boolean;
  reason?: string;
  /** Balances after the action (unchanged on failure). */
  coin: number;
  dust: number;
  /** Coin for sell, dust for salvage. */
  gained?: number;
  /** What left the bag. */
  items?: string[];
  stacks?: { defId: string; count: number }[];
}

/** Body of an error thrown from an RPC or hook (docs/protokol.md, Hata kodları). */
export function errorMessage(code: string, message: string): string {
  return JSON.stringify({ code, message });
}

export interface ProfileResponse {
  userId: string;
  username: string;
  score: number;
  /** Pages whose every record was found. */
  pagesComplete: string[];
  level: number;
  /** Showcase items as they sit in the book now. */
  showcase: ItemInstance[];
  hunting?: string;
}

export interface SetProfileRequest {
  /** Book record ids; each needs a filled slot. Omit to keep. */
  showcase?: string[];
  /** A book record id, or null to clear. Omit to keep. */
  hunting?: string | null;
}

export interface GotoFriendMsg {
  userId: string;
}

/** Sent to the player who was moved; others see the new place in SNAPSHOT / PLAYER_ENTER. */
export interface TeleportMsg {
  x: number;
  y: number;
  /** Set when the move was refused: NOT_FRIEND, NOT_HERE, NO_SPOT, RATE_LIMITED. */
  reason?: string;
}

export interface EmoteShowMsg {
  id: string;
  emote: string;
  /** show_fish: the last thing this player caught. */
  defId?: string;
}

/** A persistent status emote changed (or was refused: then only the sender gets it, with the current value). */
export interface EmoteStatusShowMsg {
  id: string;
  /** Emote now worn, or null when none. */
  emote: string | null;
  /** Set when the request was refused: NOT_OWNED, RATE_LIMITED. */
  reason?: string;
}

/** A server-wide announcement. For now only a rare catch (Epic and above). */
export interface AnnounceMsg {
  kind: 'rare_catch';
  /** Who caught it. */
  id: string;
  name: string;
  defId: string;
  tier: Tier;
  /** Condition name only, never the raw Float. */
  condition: string;
}

// --- Faz 5: trade (docs/protokol.md, Takas) ---

export interface TradeOfferView {
  items: ItemInstance[];
  stacks: { defId: string; count: number }[];
  coin: number;
}

/** S → C, op 46: the window as one side sees it. */
export interface TradeStateMsg {
  tradeId: string;
  withId: string;
  withName: string;
  you: TradeOfferView;
  them: TradeOfferView;
  youLocked: boolean;
  themLocked: boolean;
  youConfirmed: boolean;
  themConfirmed: boolean;
  /** Both locked: ms until Confirm is accepted (0 = now). */
  confirmInMs?: number;
  /** Only to the asker: why a TRADE_SET / TRADE_LOCK was refused. */
  reason?: string;
}

/** S → C, op 45. */
export interface TradeInviteMsg {
  tradeId: string;
  from: string;
  name: string;
  expiresInMs: number;
}

export type TradeResult = 'done' | 'cancelled' | 'declined' | 'expired' | 'failed';

/** S → C, op 47. */
export interface TradeEndMsg {
  tradeId: string;
  result: TradeResult;
  reason?: string;
  /** failed / BAG_FULL: which side. */
  userId?: string;
  got?: TradeOfferView;
  gave?: { items: string[]; stacks: { defId: string; count: number }[]; coin: number };
  /** What the book did with each received item. */
  book?: (FishBookMsg & { instanceId: string })[];
}

/** S → C, op 49: answer to ITEM_LOCK. */
export interface ItemLockResultMsg {
  instanceId: string;
  locked: boolean;
  ok: boolean;
  reason?: string;
}

/** One line of a stall as shown beside the pet. `tier` is "" for stacks; `price` is per unit for stacks. */
export interface StallEntry {
  defId: string;
  tier: string;
  count: number;
  price: number;
}

export interface StallView {
  userId: string;
  name: string;
  spot: number;
  x: number;
  y: number;
  title: string;
  /** The first entries: Float items, then stacks. */
  top: StallEntry[];
  /** How many entries the stall has in all. */
  total: number;
  expiresInMs: number;
}

/** S → C, op 55: every stall of the server on join (`full`), then changes. */
export interface StallsMsg {
  full: boolean;
  stalls: StallView[];
  removed: string[];
}

/** S → C, op 54: the whole list of one stall. */
export interface StallListMsg {
  userId: string;
  name: string;
  title: string;
  items: { item: ItemInstance; price: number }[];
  stacks: { defId: string; count: number; price: number }[];
  expiresInMs: number;
}

/** S → C, op 56. */
export interface StallResultMsg {
  action: 'open' | 'recall' | 'view' | 'buy';
  ok: boolean;
  reason?: string;
  /** open: the spot given. */
  spot?: number;
  /** recall: what came back to the bag. */
  returned?: { items: ItemInstance[]; stacks: { defId: string; count: number }[] };
  /** buy: what was bought, what it cost, the balance left, and the book's answer. */
  item?: ItemInstance;
  defId?: string;
  count?: number;
  paid?: number;
  coin?: number;
  book?: FishBookMsg;
}

/** S → C, op 57. */
export interface QuestStateMsg {
  day: number;
  quests: { id: string; event: string; progress: number; target: number }[];
  complete: boolean;
  claimed: boolean;
  streak: number;
  chestDay: number;
  resetInMs: number;
}

/** S → C, op 59. */
export interface QuestClaimResultMsg {
  ok: boolean;
  reason?: string;
  streak?: number;
  chestDay?: number;
  rewards?: { kind: 'coin' | 'dust' | 'stack'; defId: string; count: number }[];
  coin?: number;
  dust?: number;
}

export interface FriendStatus {
  userId: string;
  username: string;
  online: boolean;
  /** Where they are, when online in a world server. */
  serverName?: string;
  matchId?: string;
  x?: number;
  y?: number;
}

export interface FriendsStatusResponse {
  friends: FriendStatus[];
}

/** Reply to MERGE and CRAFT, only to the player. */
export interface CraftResultMsg {
  action: 'merge' | 'craft';
  ok: boolean;
  reason?: string;
  /** Dust after the action (unchanged on failure). */
  dust: number;
  /** The new item; with `book.kind === "discovered"` it went straight to its slot. */
  item?: ItemInstance;
  /** A stack result (e.g. bait): its new total in the bag. */
  stack?: { defId: string; count: number };
  book?: FishBookMsg;
  /** What left the bag: item ids and stack counts used up. */
  items?: string[];
  stacks?: { defId: string; count: number }[];
}

/** Reply to REPAIR_ROD and BUY_BAIT, only to the player. */
export interface ShopResultMsg {
  action: 'repair' | 'buy_bait';
  ok: boolean;
  /** NOT_NEEDED, NOT_ENOUGH_COIN, BAG_FULL, BAD_REQUEST */
  reason?: string;
  /** Coin after the action (unchanged on failure). */
  coin: number;
  spent?: number;
  rod?: RodView;
  /** buy_bait: the bait's new total in the bag. */
  stack?: { defId: string; count: number };
}

export interface StashView {
  level: number;
  slotsUsed: number;
  slotsMax: number;
  items: ItemInstance[];
  stacks: { defId: string; count: number }[];
}

/** Reply to every STASH_* message, only to the player. */
export interface StashResultMsg {
  action: 'open' | 'put' | 'take' | 'expand';
  ok: boolean;
  /** NOT_AT_BANK, BAD_REQUEST, TOO_MANY, NOT_OWNED, NOT_ENOUGH, STASH_FULL, BAG_FULL, MAX_LEVEL, NOT_ENOUGH_COIN */
  reason?: string;
  /** Full contents after a successful action. */
  stash?: StashView;
  /** expand: Coin left. */
  coin?: number;
  /** put / take: what moved. */
  items?: string[];
  stacks?: { defId: string; count: number }[];
}

/** get_catalog RPC (Faz 4): display-only prices and recipes, see rules/catalog.ts. */
export type { CatalogResponse } from './rules/catalog';
