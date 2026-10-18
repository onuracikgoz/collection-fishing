// Tunable numbers for the world (docs/protokol.md). Values marked (Öneri)
// are not final; change them here, not in rules or match code.

export interface ServerDef {
  /** Stable id, used to find the match again after a restart. */
  id: string;
  name: string;
  /** ISO 639-1 code shown in the server list. */
  language: string;
}

export const SERVERS: ServerDef[] = [
  { id: 'mercan', name: 'Mercan', language: 'tr' },
  { id: 'liman', name: 'Liman', language: 'tr' },
];

export const WORLD = {
  tickRate: 10, // Hz (Öneri)
  capacity: 200, // players per server
  walkSpeed: 4, // tiles per second (Öneri)
  speedTolerance: 1.2, // accepted speed = walkSpeed × tolerance
  burstSeconds: 0.5, // most walking that can pile up between MOVEs (Öneri)
  maxMovesPerTick: 4, // extra MOVEs from one player in a tick are dropped
  viewRadius: 20, // tiles, PLAYER_ENTER inside this (Öneri)
  viewLeaveRadius: 22, // tiles, PLAYER_LEAVE outside this (Öneri)
  chatRadius: 12, // tiles, BUBBLE goes to players inside this (Öneri)
};

export const USERNAME = {
  minLength: 3, // (Öneri)
  maxLength: 16, // (Öneri)
};
