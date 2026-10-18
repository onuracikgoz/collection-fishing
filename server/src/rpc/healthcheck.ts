import { HealthcheckResponse, PROTOCOL_VERSION } from '../protocol';

export function rpcHealthcheck(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _payload: string,
): string {
  const res: HealthcheckResponse = { ok: true, serverTime: Date.now(), protocolVersion: PROTOCOL_VERSION };
  return JSON.stringify(res);
}
