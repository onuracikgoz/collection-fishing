import { USERNAME } from '../config';
import { NOTIFY_LINKED, NOTIFY_UNLINKED } from '../rpc/transferCode';
import { STARTER_RECIPES } from '../data/recipes';
import { stacksWrite } from '../match/playerData';
import { ErrorCode, errorMessage } from '../protocol';
import { isValidUsername } from '../rules/join';

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

/** A new account gets the starter recipes once (docs/tasarim/08-recipe-craft.md 10.2). */
export function afterAuthenticateDevice(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  session: nkruntime.Session,
  _req: nkruntime.AuthenticateDeviceRequest,
): void {
  if (!session.created || !ctx.userId) return;
  const stacks: { [defId: string]: number } = {};
  for (const s of STARTER_RECIPES) stacks[s.defId] = s.count;
  try {
    // version '*' writes only if the bag does not exist yet, so a retry never doubles it.
    nk.storageWrite([{ ...stacksWrite(ctx.userId, stacks), version: '*' }]);
  } catch (e) {
    logger.warn('Starter recipes not given to %s: %s', ctx.userId, String(e));
  }
}

/** Steam is linked only with a transfer code (transfer_code_redeem links it on the server). */
export function beforeLinkSteam(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _data: nkruntime.LinkSteamRequest,
): nkruntime.LinkSteamRequest {
  throw {
    message: errorMessage(ErrorCode.BAD_REQUEST, 'Steam is linked with a transfer code'),
    code: 7, // PERMISSION_DENIED
  } as nkruntime.Error;
}

/** Tells the account (shown on the next login) that a way to log in was added or removed. */
function notifyLogin(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, provider: string, linked: boolean): void {
  if (!ctx.userId) return;
  try {
    nk.notificationSend(ctx.userId, linked ? 'login_linked' : 'login_unlinked', { provider }, linked ? NOTIFY_LINKED : NOTIFY_UNLINKED, null, true);
  } catch (e) {
    logger.warn('Login notice not sent to %s: %s', ctx.userId, String(e));
  }
}

// Nakama finds hooks by their global function names, so each one is its own top-level function.
export function afterLinkDevice(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'device', true);
}
export function afterLinkGoogle(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'google', true);
}
export function afterLinkFacebook(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'facebook', true);
}
export function afterLinkCustom(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'discord', true);
}
export function afterUnlinkDevice(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'device', false);
}
export function afterUnlinkGoogle(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'google', false);
}
export function afterUnlinkFacebook(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'facebook', false);
}
export function afterUnlinkSteam(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'steam', false);
}
export function afterUnlinkCustom(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  notifyLogin(ctx, logger, nk, 'discord', false);
}
