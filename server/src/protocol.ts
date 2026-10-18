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
}

/** Body of an error thrown from an RPC or hook (docs/protokol.md, Hata kodları). */
export function errorMessage(code: string, message: string): string {
  return JSON.stringify({ code, message });
}
