import { USERNAME } from '../config';
import { STARTER_RECIPES } from '../data/recipes';
import { stacksWrite } from '../match/playerData';
import { ErrorCode, errorMessage } from '../protocol';
import { isValidUsername } from '../rules/join';
import { recordLogin } from '../match/watch';

const INVALID_ARGUMENT = 3; // nkruntime.Codes.INVALID_ARGUMENT

/** Rejects device logins that carry a username breaking the naming rule. */
export function beforeAuthenticateDevice(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  data: nkruntime.AuthenticateDeviceRequest,
): nkruntime.AuthenticateDeviceRequest {
  if (data.username !== undefined && data.username !== '' &&
      !isValidUsername(data.username, USERNAME.minLength, USERNAME.maxLength)) {
    throw {
      message: errorMessage(ErrorCode.BAD_REQUEST, 'invalid username'),
      code: INVALID_ARGUMENT,
    } as nkruntime.Error;
  }
  return data;
}

/**
 * Every login stores its IP for the multi-account signals (rules/watch.ts).
 * A new account also gets the starter recipes once (docs/tasarim/08-recipe-craft.md 10.2).
 */
export function afterAuthenticateDevice(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  session: nkruntime.Session,
  _req: nkruntime.AuthenticateDeviceRequest,
): void {
  if (!ctx.userId) return;
  try {
    recordLogin(nk, ctx.userId, ctx.clientIp || '', !!session.created, Date.now());
  } catch (e) {
    logger.warn('Login IP not saved for %s: %s', ctx.userId, String(e));
  }
  if (!session.created) return;
  const stacks: { [defId: string]: number } = {};
  for (const s of STARTER_RECIPES) stacks[s.defId] = s.count;
  try {
    // version '*' writes only if the bag does not exist yet, so a retry never doubles it.
    nk.storageWrite([{ ...stacksWrite(ctx.userId, stacks), version: '*' }]);
  } catch (e) {
    logger.warn('Starter recipes not given to %s: %s', ctx.userId, String(e));
  }
}
