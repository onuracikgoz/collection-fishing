// Account deletion: rules, the three RPCs, login cancel, blocks, and the sweep (fake Nakama).
import { describe, expect, it } from 'vitest';
import { ACCOUNT_DELETE } from '../src/config';
import { beforeAuthenticateDevice, afterAuthenticateGoogle } from '../src/hooks/auth';
import { blockedReason, rpcAccountDeleteCancel, rpcAccountDeleteRequest, rpcAccountDeleteStatus, sweepDeletions } from '../src/rpc/accountDelete';
import { isBlocked, isDue, loginIds, loginKey, nameKey, nameMatches, parseDeleteRequest } from '../src/rules/accountDelete';

const SYS = '00000000-0000-0000-0000-000000000000';

describe('account delete rules', () => {
  it('reads the request and compares the name exactly', () => {
    expect(parseDeleteRequest('{"name":"Ece"}')).toEqual({ name: 'Ece' });
    for (const p of ['', '{}', '{"name":""}', '{"name":5}', 'nope', '{"name":"' + 'x'.repeat(65) + '"}']) expect(parseDeleteRequest(p)).toBeNull();
    expect(nameMatches('Ece', 'Ece')).toBe(true);
    expect(nameMatches('ece', 'Ece')).toBe(false);
    expect(nameKey('EcE')).toBe('ece');
  });

  it('lists every login method the account has', () => {
    const ids = loginIds({ user: { googleId: 'g1', steamId: 's1', facebookId: '' }, customId: 'd1', devices: [{ id: 'dev1' }, { id: 'dev2' }] });
    expect(ids).toEqual([
      { provider: 'device', id: 'dev1' },
      { provider: 'device', id: 'dev2' },
      { provider: 'google', id: 'g1' },
      { provider: 'steam', id: 's1' },
      { provider: 'custom', id: 'd1' },
    ]);
    expect(loginKey('google', 'g1')).toBe('google:g1');
  });

  it('knows when a block or a deletion is in force', () => {
    expect(isDue(100, 100)).toBe(true);
    expect(isDue(100, 99)).toBe(false);
    expect(isDue('x', 99)).toBe(false);
    expect(isBlocked({ until: 10 }, 9)).toBe(true);
    expect(isBlocked({ until: 10 }, 10)).toBe(false);
    expect(isBlocked(null, 0)).toBe(false);
  });
});

function world() {
  const store = new Map<string, any>();
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const accounts: { [id: string]: any } = {};
  const notices: any[] = [];
  const deleted: string[] = [];
  const nk: any = {
    storageRead: (reqs: any[]) => reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)) })),
    storageWrite: (writes: any[]) => writes.forEach((w) => store.set(key(w.collection, w.key, w.userId), w.value)),
    storageDelete: (dels: any[]) => dels.forEach((d) => store.delete(key(d.collection, d.key, d.userId))),
    storageList: (userId: string, collection: string) => ({
      objects: [...store.keys()].filter((k) => k.startsWith(`${collection}/`) && k.endsWith(`/${userId}`)).map((k) => ({ collection, key: k.split('/')[1], userId, value: store.get(k) })),
    }),
    accountGetId: (id: string) => {
      if (!accounts[id]) throw new Error('not found');
      return accounts[id];
    },
    accountDeleteId: (id: string) => {
      delete accounts[id];
      deleted.push(id);
    },
    notificationSend: (...a: any[]) => notices.push(a),
  };
  const logger: any = { warn: () => undefined, error: () => undefined };
  const addAccount = (id: string, username: string, extra: any = {}) => {
    accounts[id] = { user: { username, googleId: '', steamId: '', facebookId: '', ...(extra.user || {}) }, customId: extra.customId || '', devices: extra.devices || [] };
  };
  const ctx = (userId?: string): any => ({ userId });
  return { nk, logger, store, key, accounts, notices, deleted, addAccount, ctx };
}

describe('account delete RPCs', () => {
  it('queues a request 14 days out and keeps the first time on a repeat', () => {
    const w = world();
    w.addAccount('u1', 'Ece');
    const before = Date.now();
    const r = JSON.parse(rpcAccountDeleteRequest(w.ctx('u1'), w.logger, w.nk, '{"name":"Ece"}'));
    expect(r.runAt).toBeGreaterThanOrEqual(before + ACCOUNT_DELETE.waitMs);
    const again = JSON.parse(rpcAccountDeleteRequest(w.ctx('u1'), w.logger, w.nk, '{"name":"Ece"}'));
    expect(again.runAt).toBe(r.runAt);
    expect(JSON.parse(rpcAccountDeleteStatus(w.ctx('u1'), w.logger, w.nk, '{}'))).toEqual({ pending: true, runAt: r.runAt });
    expect(JSON.parse(rpcAccountDeleteStatus(w.ctx('u2'), w.logger, w.nk, '{}'))).toEqual({ pending: false, runAt: 0 });
  });

  it('refuses a wrong name, a bad body and no session', () => {
    const w = world();
    w.addAccount('u1', 'Ece');
    expect(() => rpcAccountDeleteRequest(w.ctx('u1'), w.logger, w.nk, '{"name":"ece"}')).toThrow();
    expect(() => rpcAccountDeleteRequest(w.ctx('u1'), w.logger, w.nk, '{}')).toThrow();
    expect(() => rpcAccountDeleteRequest(w.ctx(undefined), w.logger, w.nk, '{"name":"Ece"}')).toThrow();
    expect(w.store.size).toBe(0);
  });

  it('cancels, also when nothing is queued', () => {
    const w = world();
    w.addAccount('u1', 'Ece');
    rpcAccountDeleteRequest(w.ctx('u1'), w.logger, w.nk, '{"name":"Ece"}');
    expect(JSON.parse(rpcAccountDeleteCancel(w.ctx('u1'), w.logger, w.nk, '{}'))).toEqual({ ok: true });
    expect(JSON.parse(rpcAccountDeleteStatus(w.ctx('u1'), w.logger, w.nk, '{}')).pending).toBe(false);
    expect(JSON.parse(rpcAccountDeleteCancel(w.ctx('u1'), w.logger, w.nk, '{}'))).toEqual({ ok: true });
  });

  it('a login of an existing account cancels the pending deletion and says so', () => {
    const w = world();
    w.addAccount('u1', 'Ece');
    rpcAccountDeleteRequest(w.ctx('u1'), w.logger, w.nk, '{"name":"Ece"}');
    afterAuthenticateGoogle(w.ctx('u1'), w.logger, w.nk, { created: false } as any);
    expect(JSON.parse(rpcAccountDeleteStatus(w.ctx('u1'), w.logger, w.nk, '{}')).pending).toBe(false);
    expect(w.notices.length).toBe(1);
    expect(w.notices[0][3]).toBe(104);
    // No pending deletion: no notice.
    afterAuthenticateGoogle(w.ctx('u1'), w.logger, w.nk, { created: false } as any);
    expect(w.notices.length).toBe(1);
  });
});

describe('sweep and blocks', () => {
  it('deletes what is due, leaves login and name blocks, and keeps what is not due', () => {
    const w = world();
    w.addAccount('u1', 'Ece', { user: { googleId: 'g1' }, devices: [{ id: 'dev1' }] });
    w.addAccount('u2', 'Ali');
    rpcAccountDeleteRequest(w.ctx('u1'), w.logger, w.nk, '{"name":"Ece"}');
    rpcAccountDeleteRequest(w.ctx('u2'), w.logger, w.nk, '{"name":"Ali"}');
    const now = Date.now();
    w.store.set(w.key('deletion_queue', 'u1', SYS), { runAt: now - 1 });
    expect(sweepDeletions(w.nk, w.logger, now)).toBe(1);
    expect(w.deleted).toEqual(['u1']);
    expect(w.store.has(w.key('deletion_queue', 'u1', SYS))).toBe(false);
    expect(w.store.has(w.key('deletion_queue', 'u2', SYS))).toBe(true);
    expect(w.store.get(w.key('login_block', 'google:g1', SYS)).until).toBe(now + ACCOUNT_DELETE.loginBlockMs);
    expect(w.store.get(w.key('login_block', 'device:dev1', SYS)).until).toBe(now + ACCOUNT_DELETE.loginBlockMs);
    expect(w.store.get(w.key('name_reserve', 'ece', SYS)).until).toBe(now + ACCOUNT_DELETE.nameBlockMs);
  });

  it('waits for a player who is still in a server, but not for a stale session', () => {
    const w = world();
    w.addAccount('u1', 'Ece');
    const now = Date.now();
    w.store.set(w.key('deletion_queue', 'u1', SYS), { runAt: now - 1 });
    w.store.set(w.key('player', 'session', 'u1'), { serverId: 'mercan', at: now - 1000 });
    expect(sweepDeletions(w.nk, w.logger, now)).toBe(0);
    w.store.set(w.key('player', 'session', 'u1'), { serverId: 'mercan', at: now - ACCOUNT_DELETE.staleSessionMs - 1 });
    expect(sweepDeletions(w.nk, w.logger, now)).toBe(1);
  });

  it('drops a queue entry whose account is already gone', () => {
    const w = world();
    const now = Date.now();
    w.store.set(w.key('deletion_queue', 'ghost', SYS), { runAt: now - 1 });
    expect(sweepDeletions(w.nk, w.logger, now)).toBe(1);
    expect(w.store.size).toBe(0);
    expect(w.deleted).toEqual([]);
  });

  it('blocks a device or a name that was deleted recently, until the time is up', () => {
    const w = world();
    const now = Date.now();
    w.store.set(w.key('login_block', 'device:dev1', SYS), { until: now + 1000 });
    w.store.set(w.key('name_reserve', 'ece', SYS), { until: now + 1000 });
    const data = (id: string, username?: string): any => ({ account: { id }, username });
    expect(() => beforeAuthenticateDevice(w.ctx(), w.logger, w.nk, data('dev1', 'Zed'))).toThrow(/ACCOUNT_RECENTLY_DELETED/);
    expect(() => beforeAuthenticateDevice(w.ctx(), w.logger, w.nk, data('dev2', 'ECE'))).toThrow(/NAME_RESERVED/);
    expect(beforeAuthenticateDevice(w.ctx(), w.logger, w.nk, data('dev2', 'Zed')).username).toBe('Zed');
    expect(beforeAuthenticateDevice(w.ctx(), w.logger, w.nk, data('dev3')).account.id).toBe('dev3');
    w.store.set(w.key('login_block', 'device:dev1', SYS), { until: Date.now() - 1 });
    expect(beforeAuthenticateDevice(w.ctx(), w.logger, w.nk, data('dev1', 'Zed')).account.id).toBe('dev1');
  });

  it('deletes a new Google account again when its Google id or name was deleted recently', () => {
    const w = world();
    const now = Date.now();
    w.store.set(w.key('login_block', 'google:g9', SYS), { until: now + 1000 });
    w.addAccount('n1', 'Fresh', { user: { googleId: 'g9' } });
    afterAuthenticateGoogle(w.ctx('n1'), w.logger, w.nk, { created: true } as any);
    expect(w.deleted).toEqual(['n1']);
    w.addAccount('n2', 'Ok', { user: { googleId: 'g10' } });
    afterAuthenticateGoogle(w.ctx('n2'), w.logger, w.nk, { created: true } as any);
    expect(w.deleted).toEqual(['n1']);
    expect(blockedReason(w.nk, w.accounts.n2, now)).toBeNull();
  });
});
