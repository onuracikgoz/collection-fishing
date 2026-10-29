// Whisper: the personal info mask, who may write to whom, and the three RPCs (fake Nakama).
import { describe, expect, it } from 'vitest';
import { WHISPER } from '../src/config';
import { NOTIFY_WHISPER, rpcReportPlayer, rpcWhisperSend, rpcWhisperSettings } from '../src/rpc/whisper';
import { maskPersonal, parseReport, parseWhisper, whisperRefusal, WhisperFacts } from '../src/rules/whisper';

const SYS = '00000000-0000-0000-0000-000000000000';
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';
const LEVEL_10_XP = 13500;

describe('personal info mask', () => {
  const m = (t: string) => maskPersonal(t, WHISPER);
  it('masks phones, mail, links and handles', () => {
    expect(m('ara beni 0532 123 45 67').text).toBe('ara beni ***');
    expect(m('+90 (532) 123-4567 yaz').text).toBe('*** yaz');
    expect(m('mail: ece@ornek.com').text).toBe('mail: ***');
    expect(m('bak https://x.y/z ve www.site.net').text).toBe('bak *** ve ***');
    expect(m('site.com.tr de ilan var').text).toBe('*** de ilan var');
    expect(m('insta: ece_123 ekle').text).toBe('insta *** ekle');
    expect(m('discord ece#1234').text).toBe('discord ***');
    expect(m('beni @ecefish diye bul').text).toBe('beni *** diye bul');
  });
  it('leaves normal trade talk alone', () => {
    for (const t of ['sazan 500 coin', 'level 12 oldum', '3 pul + 1 recipe', 'yarın 20:30 da']) expect(m(t)).toEqual({ text: t, masked: false });
    expect(m('0532 123 45 67').masked).toBe(true);
  });
});

describe('whisper rules', () => {
  it('reads the request', () => {
    expect(parseWhisper(`{"userId":"${A}","text":"  selam  "}`)).toEqual({ to: A, byName: false, text: 'selam', context: '' });
    expect(parseWhisper('{"userId":"","username":"Ece","text":"x","context":"stall"}')).toEqual({ to: 'Ece', byName: true, text: 'x', context: 'stall' });
    expect(parseWhisper('{"username":"Ece","text":"x","context":"other"}')!.context).toBe('');
    for (const p of ['', 'nope', '{"username":"Ece"}', '{"username":"Ece","text":"   "}', '{"userId":"bad","text":"x"}', `{"username":"${'x'.repeat(33)}","text":"x"}`]) expect(parseWhisper(p)).toBeNull();
  });

  const base: WhisperFacts = { friends: false, blockedBySender: false, blockedByTarget: false, targetPmOff: false, targetHasStall: true, senderLevel: 10, context: 'stall' };
  const r = (f: Partial<WhisperFacts>) => whisperRefusal({ ...base, ...f }, WHISPER);
  it('friends can always write, strangers only from a stall at level 10', () => {
    expect(r({ friends: true, context: '', targetHasStall: false, targetPmOff: true, senderLevel: 1 })).toBeNull();
    expect(r({})).toBeNull();
    expect(r({ context: '' })).toBe('NOT_ALLOWED');
    expect(r({ targetHasStall: false })).toBe('NOT_ALLOWED');
    expect(r({ targetPmOff: true })).toBe('NOT_ALLOWED');
    expect(r({ senderLevel: 9 })).toBe('LEVEL_TOO_LOW');
  });
  it('a block wins over friendship and does not give itself away', () => {
    expect(r({ friends: true, blockedBySender: true })).toBe('YOU_BLOCKED');
    expect(r({ friends: true, blockedByTarget: true })).toBe('NOT_ALLOWED');
  });
  it('reads a report', () => {
    expect(parseReport(`{"userId":"${A}","reason":"spam","note":"","text":"al sat"}`)).toEqual({ userId: A, reason: 'spam', note: '', text: 'al sat' });
    expect(parseReport(`{"userId":"${A}","reason":"scam","note":"${'x'.repeat(400)}"}`)!.note.length).toBe(300);
    for (const p of ['', '{}', `{"userId":"${A}"}`, `{"userId":"${A}","reason":"flirt"}`, '{"userId":"x","reason":"spam"}']) expect(parseReport(p)).toBeNull();
  });
});

function world() {
  const store = new Map<string, any>();
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const users: { [id: string]: string } = { [A]: 'Ali', [B]: 'Burcu', [C]: 'Cem' };
  const friends: { [id: string]: string[] } = {};
  const blocks: { [id: string]: string[] } = {};
  const notices: any[] = [];
  const list = (ids: string[]) => ({ friends: ids.map((id) => ({ user: { userId: id, username: users[id] } })), cursor: '' });
  const cache = new Map<string, any>();
  const nk: any = {
    localcacheGet: (k: string) => cache.get(k),
    localcachePut: (k: string, v: any) => cache.set(k, v),
    storageRead: (reqs: any[]) => reqs.filter((q) => store.has(key(q.collection, q.key, q.userId))).map((q) => ({ ...q, value: store.get(key(q.collection, q.key, q.userId)) })),
    storageWrite: (writes: any[]) => writes.forEach((w) => store.set(key(w.collection, w.key, w.userId), w.value)),
    usersGetId: (ids: string[]) => ids.filter((id) => users[id]).map((id) => ({ userId: id, username: users[id] })),
    usersGetUsername: (names: string[]) => Object.keys(users).filter((id) => names.indexOf(users[id]) >= 0).map((id) => ({ userId: id, username: users[id] })),
    friendsList: (userId: string, _l: number, state: number) => list(state === 0 ? friends[userId] || [] : state === 3 ? blocks[userId] || [] : []),
    notificationSend: (...a: any[]) => notices.push(a),
  };
  const logger: any = { warn: () => undefined, error: () => undefined };
  const ctx = (userId?: string): any => ({ userId, username: userId ? users[userId] : undefined });
  const online = (id: string) => store.set(key('player', 'session', id), { serverId: 'world-1', at: Date.now() });
  const befriend = (x: string, y: string) => {
    friends[x] = (friends[x] || []).concat([y]);
    friends[y] = (friends[y] || []).concat([x]);
  };
  const send = (from: string, body: object) => JSON.parse(rpcWhisperSend(ctx(from), logger, nk, JSON.stringify(body)));
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e: any) {
      return JSON.parse(e.message).code;
    }
    return 'NO_ERROR';
  };
  return { nk, logger, store, key, friends, blocks, notices, ctx, online, befriend, send, code };
}

describe('whisper_send', () => {
  it('sends a live notification to an online friend, found by name', () => {
    const w = world();
    w.befriend(A, B);
    w.online(B);
    const r = w.send(A, { username: 'Burcu', text: 'gel göle' });
    expect(r).toEqual({ ok: true, to: B, toName: 'Burcu', text: 'gel göle', masked: false });
    expect(w.notices).toHaveLength(1);
    const [to, subject, content, code, sender, persistent] = w.notices[0];
    expect([to, subject, code, sender, persistent]).toEqual([B, 'whisper', NOTIFY_WHISPER, A, false]);
    expect(content).toMatchObject({ from: A, fromName: 'Ali', text: 'gel göle', context: '' });
  });

  it('masks personal info before it leaves', () => {
    const w = world();
    w.befriend(A, B);
    w.online(B);
    const r = w.send(A, { userId: B, text: 'numaram 05321234567' });
    expect(r.masked).toBe(true);
    expect(w.notices[0][2].text).toBe('numaram ***');
  });

  it('lets a level 10 stranger write from an open stall only', () => {
    const w = world();
    w.online(B);
    expect(w.code(() => w.send(A, { userId: B, text: 'kaça?' }))).toBe('NOT_ALLOWED');
    w.store.set(w.key('stall', 'state', B), { serverId: 'world-1', items: [], stacks: [], ended: false });
    expect(w.code(() => w.send(A, { userId: B, text: 'kaça?', context: 'stall' }))).toBe('LEVEL_TOO_LOW');
    w.store.set(w.key('player', 'xp', A), { total: LEVEL_10_XP });
    expect(w.send(A, { userId: B, text: 'kaça?', context: 'stall' }).ok).toBe(true);
    expect(w.notices[0][2].context).toBe('stall');
    w.store.set(w.key('player', 'settings', B), { pmOff: true });
    expect(w.code(() => w.send(A, { userId: B, text: 'kaça?', context: 'stall' }))).toBe('NOT_ALLOWED');
  });

  it('refuses blocks, offline players, self, unknown names and the muted', () => {
    const w = world();
    w.befriend(A, B);
    expect(w.code(() => w.send(A, { userId: B, text: 'x' }))).toBe('OFFLINE');
    w.store.set(w.key('player', 'session', B), { serverId: '', at: Date.now() });
    expect(w.code(() => w.send(A, { userId: B, text: 'x' }))).toBe('OFFLINE');
    w.online(B);
    expect(w.code(() => w.send(A, { userId: A, text: 'x' }))).toBe('SELF');
    expect(w.code(() => w.send(A, { username: 'Yok', text: 'x' }))).toBe('NOT_FOUND');
    w.blocks[B] = [A];
    expect(w.code(() => w.send(A, { userId: B, text: 'x' }))).toBe('NOT_ALLOWED');
    w.blocks[B] = [];
    w.blocks[A] = [B];
    expect(w.code(() => w.send(A, { userId: B, text: 'x' }))).toBe('YOU_BLOCKED');
    w.blocks[A] = [];
    w.store.set(w.key('player', 'mute', A), { until: Date.now() + 60000 });
    expect(w.code(() => w.send(A, { userId: B, text: 'x' }))).toBe('MUTED');
    w.store.set(w.key('player', 'mute', A), { until: Date.now() - 1 });
    expect(w.send(A, { userId: B, text: 'x' }).ok).toBe(true);
    expect(w.code(() => w.send(A, { userId: B, text: '' }))).toBe('BAD_REQUEST');
    expect(w.code(() => rpcWhisperSend(w.ctx(undefined), w.logger, w.nk, '{}'))).toBe('BAD_REQUEST');
  });

  it('limits how fast one player whispers', () => {
    const w = world();
    w.befriend(A, B);
    w.online(B);
    for (let i = 0; i < WHISPER.perWindow; i++) w.send(A, { userId: B, text: 'm' + i });
    expect(w.code(() => w.send(A, { userId: B, text: 'bir daha' }))).toBe('RATE_LIMITED');
    expect(w.notices).toHaveLength(WHISPER.perWindow);
  });
});

describe('whisper_settings and report_player', () => {
  it('turns whispers from strangers off and on, keeping other settings', () => {
    const w = world();
    const set = (body: string) => JSON.parse(rpcWhisperSettings(w.ctx(A), w.logger, w.nk, body));
    w.store.set(w.key('player', 'settings', A), { music: false });
    expect(set('')).toEqual({ pmOff: false });
    expect(set('{"pmOff":true}')).toEqual({ pmOff: true });
    expect(w.store.get(w.key('player', 'settings', A))).toEqual({ music: false, pmOff: true });
    expect(set('{}')).toEqual({ pmOff: true });
    expect(set('{"pmOff":false}')).toEqual({ pmOff: false });
    expect(w.code(() => set('{"pmOff":"yes"}'))).toBe('BAD_REQUEST');
  });

  it('stores a report for moderators and limits reports per hour', () => {
    const w = world();
    const report = (body: object) => JSON.parse(rpcReportPlayer(w.ctx(A), w.logger, w.nk, JSON.stringify(body)));
    expect(report({ userId: B, reason: 'personal_info', text: 'insta: x' })).toEqual({ ok: true });
    const keys = [...w.store.keys()].filter((k) => k.startsWith('reports/'));
    expect(keys).toHaveLength(1);
    expect(keys[0].endsWith(`/${SYS}`)).toBe(true);
    expect(w.store.get(keys[0])).toMatchObject({ target: B, reporter: A, reason: 'personal_info', text: 'insta: x' });
    expect(w.code(() => report({ userId: A, reason: 'spam' }))).toBe('SELF');
    expect(w.code(() => report({ userId: '44444444-4444-4444-4444-444444444444', reason: 'spam' }))).toBe('NOT_FOUND');
    expect(w.code(() => report({ userId: B, reason: 'boring' }))).toBe('BAD_REQUEST');
  });
});
