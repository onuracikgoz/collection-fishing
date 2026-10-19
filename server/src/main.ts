import { afterAuthenticateDevice, beforeAuthenticateDevice } from './hooks/auth';
import { ensureServers } from './match/servers';
import {
  worldInit,
  worldJoin,
  worldJoinAttempt,
  worldLeave,
  worldLoop,
  worldSignal,
  worldTerminate,
} from './match/world';
import { rpcHealthcheck } from './rpc/healthcheck';
import { rpcListServers } from './rpc/listServers';
import { rpcGetInventory } from './rpc/getInventory';
import { rpcGetBook } from './rpc/getBook';
import { rpcGetProfile, rpcSetProfile } from './rpc/profile';
import { rpcFriendsStatus } from './rpc/friendsStatus';

// Nakama finds handlers by their global function names, so every handler is
// passed here directly as a top-level function, never wrapped.
function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
) {
  initializer.registerRpc('healthcheck', rpcHealthcheck);
  initializer.registerRpc('list_servers', rpcListServers);
  initializer.registerRpc('get_inventory', rpcGetInventory);
  initializer.registerRpc('get_book', rpcGetBook);
  initializer.registerRpc('get_profile', rpcGetProfile);
  initializer.registerRpc('set_profile', rpcSetProfile);
  initializer.registerRpc('friends_status', rpcFriendsStatus);
  initializer.registerBeforeAuthenticateDevice(beforeAuthenticateDevice);
  initializer.registerAfterAuthenticateDevice(afterAuthenticateDevice);
  initializer.registerMatch('world', {
    matchInit: worldInit,
    matchJoinAttempt: worldJoinAttempt,
    matchJoin: worldJoin,
    matchLeave: worldLeave,
    matchLoop: worldLoop,
    matchTerminate: worldTerminate,
    matchSignal: worldSignal,
  });
  try {
    ensureServers(nk, logger);
  } catch (e) {
    // list_servers creates them on first call instead.
    logger.warn('Could not create servers at startup: %s', String(e));
  }
  logger.info('CollectionGame server module loaded');
}

// Keeps InitModule in the bundle; Nakama looks it up by name.
// @ts-ignore
!InitModule && InitModule.bind(null);
