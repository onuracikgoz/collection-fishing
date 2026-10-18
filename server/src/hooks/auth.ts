import { USERNAME } from '../config';
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
