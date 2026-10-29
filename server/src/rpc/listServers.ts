import { ensureServers } from '../match/servers';
import { ListServersResponse } from '../protocol';
import { rpcLimit } from './limit';

export function rpcListServers(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  rpcLimit(nk, ctx.userId, 'list_servers');
  const res: ListServersResponse = { servers: ensureServers(nk, logger) };
  return JSON.stringify(res);
}
