import { readInventory } from '../match/playerData';

export function rpcGetInventory(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  if (!ctx.userId) throw { message: 'no user', code: 16 } as nkruntime.Error;
  return JSON.stringify(readInventory(nk, ctx.userId));
}
