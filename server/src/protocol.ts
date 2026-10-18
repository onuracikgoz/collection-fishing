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
