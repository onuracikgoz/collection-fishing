// The world match end to end with a fake Nakama: join, see each other, wear a status emote.
import { describe, expect, it } from 'vitest';
import { OpCode } from '../src/protocol';
import { worldInit, worldJoin, worldJoinAttempt, worldLoop } from '../src/match/world';

function setup() {
  const store = new Map<string, any>();
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const sent: { op: number; body: any; to: string[] }[] = [];
  const nk: any = {
    storageRead: (reqs: any[]) => reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)) })),
    storageWrite: (writes: any[]) => writes.forEach((w) => store.set(key(w.collection, w.key, w.userId), w.value)),
    storageList: () => ({ objects: [] }),
    accountGetId: () => ({ wallet: {} }),
    binaryToString: (d: string) => d,
    uuidv4: () => 'id',
  };
  const dispatcher: any = {
    broadcastMessage: (op: number, data: string, to: any[] | null) => sent.push({ op, body: JSON.parse(data), to: (to || []).map((p) => p.userId) }),
    matchKick: () => undefined,
  };
  const logger: any = { error: (...a: any[]) => console.log('ERR', ...a), warn: () => undefined, info: () => undefined };
  const init = worldInit({} as any, logger, nk, { serverId: 'mercan' });
  let state = init.state;
  let tick = 0;
  const presence = (id: string): any => ({ userId: id, sessionId: `s-${id}`, username: id, node: 'n' });
  const join = (id: string) => {
    const pr = presence(id);
    state = worldJoinAttempt({} as any, logger, nk, dispatcher, tick, state, pr, { protocolVersion: '1', characterId: 'default' }).state;
    state = worldJoin({} as any, logger, nk, dispatcher, tick, state, [pr])!.state;
  };
  const loop = (msgs: { id: string; op: number; body: unknown }[] = []) => {
    tick++;
    state = worldLoop({} as any, logger, nk, dispatcher, tick, state, msgs.map((m) => ({ sender: presence(m.id), opCode: m.op, data: JSON.stringify(m.body) })) as any)!.state;
  };
  return { sent, join, loop, take: (op: number) => sent.filter((m) => m.op === op) };
}

describe('world match: status emote', () => {
  it('shows a worn status emote to a nearby player and to the wearer, refuses one not owned, and removes it', () => {
    const w = setup();
    w.join('B');
    w.join('C');
    w.loop();
    w.loop();
    expect(w.take(OpCode.PLAYER_ENTER).length).toBe(2);
    w.loop([{ id: 'C', op: OpCode.EMOTE_STATUS, body: { emote: 'heart' } }]);
    const shown = w.take(OpCode.EMOTE_STATUS_SHOW);
    expect(shown.length).toBe(1);
    expect(shown[0].body).toEqual({ id: 'C', emote: 'heart' });
    expect(shown[0].to.sort()).toEqual(['B', 'C']);
    for (let i = 0; i < 12; i++) w.loop();
    w.loop([{ id: 'C', op: OpCode.EMOTE_STATUS, body: { emote: 'star' } }]);
    const refused = w.take(OpCode.EMOTE_STATUS_SHOW).slice(-1)[0];
    expect(refused.body).toMatchObject({ reason: 'NOT_OWNED', emote: 'heart' });
    expect(refused.to).toEqual(['C']);
    for (let i = 0; i < 12; i++) w.loop();
    w.loop([{ id: 'C', op: OpCode.EMOTE_STATUS, body: { emote: null } }]);
    expect(w.take(OpCode.EMOTE_STATUS_SHOW).slice(-1)[0].body.emote).toBeNull();
  });
});
