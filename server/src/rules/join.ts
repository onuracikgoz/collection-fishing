// Join and login checks. Pure functions, no Nakama dependency.
import { ErrorCode, PROTOCOL_VERSION } from '../protocol';

export type JoinCheck = { ok: true; characterId: string } | { ok: false; error: string };

const CHARACTER_ID = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * Checks a match join. `playerCount` should not count an older session of the
 * same account, since that one gets replaced.
 */
export function checkJoin(metadata: unknown, playerCount: number, capacity: number): JoinCheck {
  const meta = (typeof metadata === 'object' && metadata !== null ? metadata : {}) as Record<string, unknown>;
  // Nakama sends metadata values as strings.
  if (Number(meta.protocolVersion) !== PROTOCOL_VERSION) return { ok: false, error: ErrorCode.PROTOCOL_MISMATCH };
  const raw = meta.characterId;
  const characterId = raw === undefined || raw === '' ? 'default' : raw;
  if (typeof characterId !== 'string' || !CHARACTER_ID.test(characterId)) {
    return { ok: false, error: ErrorCode.BAD_REQUEST };
  }
  if (playerCount >= capacity) return { ok: false, error: ErrorCode.SERVER_FULL };
  return { ok: true, characterId };
}

const USERNAME_CHARS = /^[A-Za-z0-9_ÇĞİÖŞÜçğıöşü]+$/;

export function isValidUsername(name: unknown, minLength: number, maxLength: number): boolean {
  if (typeof name !== 'string') return false;
  return name.length >= minLength && name.length <= maxLength && USERNAME_CHARS.test(name);
}
