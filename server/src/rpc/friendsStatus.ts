// friends_status: mutual friends, who is online, in which server and where (10-sosyal.md 13.2.1).
// Adding and accepting friends uses Nakama's own friend API from the client.
import { mutualFriends } from '../match/friends';
import { findWorldMatches } from '../match/servers';
import { ErrorCode, FriendStatus, FriendsStatusResponse, errorMessage } from '../protocol';

export function rpcFriendsStatus(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  if (!ctx.userId) throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'no user'), code: 16 } as nkruntime.Error;
  const friends = mutualFriends(nk, ctx.userId);
  const out: FriendStatus[] = friends.map((f) => ({ userId: f.userId, username: f.username, online: false }));
  if (out.length > 0) {
    const byId: { [id: string]: FriendStatus } = {};
    for (const f of out) byId[f.userId] = f;
    const ask = JSON.stringify({ type: 'where', userIds: out.map((f) => f.userId) });
    const matches = findWorldMatches(nk);
    for (const serverId in matches) {
      const matchId = matches[serverId].matchId;
      let reply: { serverName?: string; players?: { [id: string]: { x: number; y: number } } };
      try {
        reply = JSON.parse(nk.matchSignal(matchId, ask) || '{}');
      } catch (e) {
        logger.warn('Friend lookup in %s failed: %s', matchId, String(e));
        continue;
      }
      for (const id in reply.players || {}) {
        const f = byId[id];
        if (!f || f.online) continue;
        const pos = reply.players![id];
        f.online = true;
        f.serverName = reply.serverName;
        f.matchId = matchId;
        f.x = pos.x;
        f.y = pos.y;
      }
    }
  }
  const res: FriendsStatusResponse = { friends: out };
  return JSON.stringify(res);
}
