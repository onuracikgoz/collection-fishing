// Per-player RPC rate limit (docs/protokol.md, RPC hız sınırı). Counts live in Nakama's node-local
// cache, not in storage, so a client calling in a loop costs no database writes.
import { RPC_LIMITS } from '../config';
import { ErrorCode, errorMessage } from '../protocol';
import { recent, underLimit } from '../rules/transfer';

const RESOURCE_EXHAUSTED = 8;

/**
 * Takes one call from `userId`'s budget for `rpc`; throws RATE_LIMITED when it is spent.
 * Without a user id (server-to-server calls) or a local cache (unit tests) it does nothing.
 */
export function rpcLimit(nk: nkruntime.Nakama, userId: string | undefined, rpc: string, now = Date.now()): void {
  if (!userId || typeof nk.localcacheGet !== 'function') return;
  const cfg = RPC_LIMITS.rpcs[rpc] || RPC_LIMITS.default;
  const key = `rl:${rpc}:${userId}`;
  let times: number[] = [];
  try {
    const raw = nk.localcacheGet(key);
    const v = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (Array.isArray(v)) times = v.filter((t): t is number => typeof t === 'number');
  } catch (_e) {
    times = [];
  }
  if (!underLimit(times, now, cfg.windowMs, cfg.perWindow)) {
    throw { message: errorMessage(ErrorCode.RATE_LIMITED, `too many ${rpc} calls`), code: RESOURCE_EXHAUSTED } as nkruntime.Error;
  }
  nk.localcachePut(key, JSON.stringify(recent(times, now, cfg.windowMs).concat([now])), Math.ceil(cfg.windowMs / 1000) + 1);
}
