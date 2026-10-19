// Mutual friends from Nakama's friend list (state 0 = both accepted).
import { FRIENDS } from '../config';

export function mutualFriends(nk: nkruntime.Nakama, userId: string): { userId: string; username: string }[] {
  const out: { userId: string; username: string }[] = [];
  let cursor: string | undefined = undefined;
  while (out.length < FRIENDS.maxListed) {
    const res: nkruntime.FriendList = nk.friendsList(userId, 100, 0, cursor);
    for (const f of res.friends || []) {
      if (f.user && f.user.userId) out.push({ userId: f.user.userId, username: f.user.username || '' });
    }
    cursor = res.cursor;
    if (!cursor) break;
  }
  return out;
}

export function areFriends(nk: nkruntime.Nakama, userId: string, otherId: string): boolean {
  return mutualFriends(nk, userId).some((f) => f.userId === otherId);
}
