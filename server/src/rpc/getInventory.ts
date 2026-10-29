import { readInventory } from '../match/playerData';
import { rpcLimit } from './limit';

export function rpcGetInventory(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  rpcLimit(nk, ctx.userId, 'get_inventory');
  if (!ctx.userId) throw { message: 'no user', code: 16 } as nkruntime.Error;
  return JSON.stringify(readInventory(nk, ctx.userId));
}
