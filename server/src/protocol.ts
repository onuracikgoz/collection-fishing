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
  source: 'fishing';
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
}

export interface InventoryResponse {
  energy: number;
  energyMax: number;
  slotsUsed: number;
  slotsMax: number;
  items: ItemInstance[];
  stacks: { defId: string; count: number }[];
}

/** Body of an error thrown from an RPC or hook (docs/protokol.md, Hata kodları). */
export function errorMessage(code: string, message: string): string {
  return JSON.stringify({ code, message });
}
