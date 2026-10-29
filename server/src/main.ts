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
import { rpcGetCatalog } from './rpc/getCatalog';
import { isDevEnabled } from './debug/gate';
import {
  rpcDevBook,
  rpcDevCraftPreview,
  rpcDevEnergy,
  rpcDevFriends,
  rpcDevGive,
  rpcDevInfo,
  rpcDevItemDelete,
  rpcDevItemEdit,
  rpcDevLive,
  rpcDevPlayer,
  rpcDevProfile,
  rpcDevReel,
  rpcDevReset,
  rpcDevSimCatch,
  rpcDevStacks,
  rpcDevSuspects,
  rpcDevUsers,
  rpcDevWallet,
  rpcDevWatch,
  rpcDevWorld,
} from './debug/rpc';

// Nakama finds handlers by their global function names, so every handler is
// passed here directly as a top-level function, never wrapped.
function InitModule(
  ctx: nkruntime.Context,
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
  initializer.registerRpc('get_catalog', rpcGetCatalog);
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
  // Developer dashboard RPCs (tools/dev-dashboard). Nakama only finds registrations
  // written straight in InitModule, so they are always registered, but every one
  // refuses to run unless DEV_TOOLS=true (local.yml). Test and live configs leave it out.
  initializer.registerRpc('dev_info', rpcDevInfo);
  initializer.registerRpc('dev_users', rpcDevUsers);
  initializer.registerRpc('dev_player', rpcDevPlayer);
  initializer.registerRpc('dev_give', rpcDevGive);
  initializer.registerRpc('dev_item_edit', rpcDevItemEdit);
  initializer.registerRpc('dev_item_delete', rpcDevItemDelete);
  initializer.registerRpc('dev_stacks', rpcDevStacks);
  initializer.registerRpc('dev_wallet', rpcDevWallet);
  initializer.registerRpc('dev_energy', rpcDevEnergy);
  initializer.registerRpc('dev_book', rpcDevBook);
  initializer.registerRpc('dev_profile', rpcDevProfile);
  initializer.registerRpc('dev_friends', rpcDevFriends);
  initializer.registerRpc('dev_reset', rpcDevReset);
  initializer.registerRpc('dev_world', rpcDevWorld);
  initializer.registerRpc('dev_live', rpcDevLive);
  initializer.registerRpc('dev_sim_catch', rpcDevSimCatch);
  initializer.registerRpc('dev_reel', rpcDevReel);
  initializer.registerRpc('dev_craft_preview', rpcDevCraftPreview);
  initializer.registerRpc('dev_suspects', rpcDevSuspects);
  initializer.registerRpc('dev_watch', rpcDevWatch);
  if (isDevEnabled(ctx)) logger.warn('DEV_TOOLS on: dev_* RPCs work. Never enable this on a test or live server.');
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
