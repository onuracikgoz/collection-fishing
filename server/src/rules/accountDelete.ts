// Account deletion rules (docs/protokol.md, Hesap silme RPC'leri). Pure functions, no Nakama dependency.

export interface DeleteConfig {
  waitMs: number;
  loginBlockMs: number;
  nameBlockMs: number;
}

/** The request body: `{ name }`. */
export function parseDeleteRequest(payload: string): { name: string } | null {
  let v: unknown;
  try {
    v = JSON.parse(payload || '{}');
  } catch (_e) {
    return null;
  }
  const name = typeof v === 'object' && v !== null ? (v as { name?: unknown }).name : undefined;
  return typeof name === 'string' && name.length > 0 && name.length <= 64 ? { name } : null;
}

/** The typed name must be the username exactly (the confirmation step). */
export const nameMatches = (typed: string, username: string): boolean => typed === username;

export const runAtOf = (now: number, cfg: DeleteConfig): number => now + cfg.waitMs;

export const isDue = (runAt: unknown, now: number): boolean => typeof runAt === 'number' && now >= runAt;

/** Storage key of a login method's block: provider and its id there. */
export const loginKey = (provider: string, id: string): string => `${provider}:${id}`.slice(0, 120);

/** Usernames are compared in lower case. */
export const nameKey = (name: string): string => name.toLowerCase().slice(0, 120);

export interface AccountIds {
  user: { facebookId?: string; googleId?: string; steamId?: string };
  customId?: string;
  devices?: { id: string }[];
}

/** Every login method the account has, as { provider, id }. */
export function loginIds(acct: AccountIds): { provider: string; id: string }[] {
  const out: { provider: string; id: string }[] = [];
  const add = (provider: string, id: string | undefined) => {
    if (id) out.push({ provider, id });
  };
  for (const d of acct.devices || []) add('device', d.id);
  add('facebook', acct.user.facebookId);
  add('google', acct.user.googleId);
  add('steam', acct.user.steamId);
  add('custom', acct.customId);
  return out;
}

/** True while a block record (`{ until }`) still holds. */
export const isBlocked = (rec: unknown, now: number): boolean =>
  typeof rec === 'object' && rec !== null && typeof (rec as { until?: unknown }).until === 'number' && (rec as { until: number }).until > now;
