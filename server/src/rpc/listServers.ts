import { ensureServers } from '../match/servers';
import { ListServersResponse } from '../protocol';

export function rpcListServers(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  const res: ListServersResponse = { servers: ensureServers(nk, logger) };
  return JSON.stringify(res);
}
