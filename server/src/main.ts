import { rpcHealthcheck } from './rpc/healthcheck';

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
) {
  initializer.registerRpc('healthcheck', rpcHealthcheck);
  logger.info('CollectionGame server module loaded');
}

// Keeps InitModule in the bundle; Nakama looks it up by name.
// @ts-ignore
!InitModule && InitModule.bind(null);
