import { SERVERS, WORLD } from '../config';
import { ServerInfo } from '../protocol';

export const WORLD_MODULE = 'world';

export interface WorldLabel {
  kind: 'world';
  serverId: string;
}

function findWorldMatches(nk: nkruntime.Nakama): { [serverId: string]: nkruntime.Match } {
  const found: { [serverId: string]: nkruntime.Match } = {};
  for (const m of nk.matchList(100, true, null, null, null, '+label.kind:world')) {
    try {
      const label = JSON.parse(m.label) as WorldLabel;
      if (!found[label.serverId]) found[label.serverId] = m;
    } catch (_e) {
      // not one of ours
    }
  }
  return found;
}

/** Makes sure every configured server has a running match, then lists them. */
export function ensureServers(nk: nkruntime.Nakama, logger: nkruntime.Logger): ServerInfo[] {
  const found = findWorldMatches(nk);
  const out: ServerInfo[] = [];
  for (const def of SERVERS) {
    let matchId: string;
    let players = 0;
    if (found[def.id]) {
      matchId = found[def.id].matchId;
      players = found[def.id].size;
    } else {
      matchId = nk.matchCreate(WORLD_MODULE, { serverId: def.id });
      logger.info('Created server %s (%s)', def.name, matchId);
    }
    out.push({ matchId, name: def.name, language: def.language, players, capacity: WORLD.capacity });
  }
  return out;
}
