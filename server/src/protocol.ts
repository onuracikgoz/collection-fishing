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
} as const;

export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  PROTOCOL_MISMATCH: 'PROTOCOL_MISMATCH',
  SERVER_FULL: 'SERVER_FULL',
  RATE_LIMITED: 'RATE_LIMITED',
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
  source: 'fishing' | 'craft' | 'merge';
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
  book?: FishBookMsg;
  /** What left the bag: item ids and stack counts used up. */
  items?: string[];
  stacks?: { defId: string; count: number }[];
}
