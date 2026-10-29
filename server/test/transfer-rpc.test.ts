// transfer_code_create / transfer_code_redeem against a fake Nakama.
import { describe, expect, it } from 'vitest';
import { TRANSFER } from '../src/config';
import { rpcTransferCodeCreate, rpcTransferCodeRedeem } from '../src/rpc/transferCode';

function fake() {
  const store = new Map<string, { value: any; version: number }>();
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const linked: { userId: string; token: string }[] = [];
  const notes: { userId: string; subject: string; code: number }[] = [];
  let version = 0;
  let linkFails = false;
  const nk: any = {
    uuidv4: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => Math.floor(Math.random() * 16).toString(16)),
    storageRead: (reqs: any[]) =>
      reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId))!.value, version: String(store.get(key(r.collection, r.key, r.userId))!.version) })),
    storageWrite: (writes: any[]) => {
      for (const w of writes) {
        const k = key(w.collection, w.key, w.userId);
        if (w.version === '*' && store.has(k)) throw new Error('exists');
        store.set(k, { value: w.value, version: ++version });
      }
    },
    storageDelete: (dels: any[]) => {
      for (const d of dels) {
        const k = key(d.collection, d.key, d.userId);
        const cur = store.get(k);
        if (d.version !== undefined && (!cur || String(cur.version) !== d.version)) throw new Error('version');
        store.delete(k);
      }
    },
    accountGetId: (userId: string) => ({ user: { username: `name-${userId}` } }),
    linkSteam: (userId: string, _name: string, token: string) => {
      if (linkFails) throw new Error('steam refused');
      linked.push({ userId, token });
    },
    notificationSend: (userId: string, subject: string, _c: object, code: number) => notes.push({ userId, subject, code }),
  };
  const logger: any = { warn: () => undefined, error: () => undefined };
  const ctx = (userId?: string, ip = '1.2.3.4'): any => ({ userId, clientIp: ip });
  return { nk, logger, ctx, store, key, linked, notes, setLinkFails: (v: boolean) => (linkFails = v) };
}

const errCode = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e: any) {
    return JSON.parse(e.message).code;
  }
  return 'none';
};

describe('transfer code RPCs (fake Nakama)', () => {
  it('makes a readable code that links Steam once', () => {
    const w = fake();
    const made = JSON.parse(rpcTransferCodeCreate(w.ctx('web-user'), w.logger, w.nk, '{}'));
    expect(made.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(made.expiresInMs).toBe(TRANSFER.ttlMs);
    const res = JSON.parse(rpcTransferCodeRedeem(w.ctx(undefined, '9.9.9.9'), w.logger, w.nk, JSON.stringify({ code: made.code.toLowerCase(), steamToken: 'ticket' })));
    expect(res).toEqual({ ok: true });
    expect(w.linked).toEqual([{ userId: 'web-user', token: 'ticket' }]);
    // The owner is told, and cannot trade for 72 hours.
    expect(w.notes).toEqual([{ userId: 'web-user', subject: 'login_linked', code: 101 }]);
    const lock = w.store.get(w.key('player', 'trade_lock', 'web-user'))!.value.until;
    expect(lock - Date.now()).toBeGreaterThan(TRANSFER.steamTradeLockMs - 5000);
    // Single use.
    expect(errCode(() => rpcTransferCodeRedeem(w.ctx(), w.logger, w.nk, JSON.stringify({ code: made.code, steamToken: 't2' })))).toBe('CODE_INVALID');
    expect(w.linked.length).toBe(1);
  });

  it('needs a session to make a code, and a newer code replaces the old one', () => {
    const w = fake();
    expect(errCode(() => rpcTransferCodeCreate(w.ctx(undefined), w.logger, w.nk, '{}'))).toBe('BAD_REQUEST');
    const first = JSON.parse(rpcTransferCodeCreate(w.ctx('u'), w.logger, w.nk, '{}')).code;
    const second = JSON.parse(rpcTransferCodeCreate(w.ctx('u'), w.logger, w.nk, '{}')).code;
    expect(first).not.toBe(second);
    expect(errCode(() => rpcTransferCodeRedeem(w.ctx(), w.logger, w.nk, JSON.stringify({ code: first, steamToken: 't' })))).toBe('CODE_INVALID');
    expect(JSON.parse(rpcTransferCodeRedeem(w.ctx(), w.logger, w.nk, JSON.stringify({ code: second, steamToken: 't' })))).toEqual({ ok: true });
  });

  it('limits how many codes an account can make per hour', () => {
    const w = fake();
    for (let i = 0; i < TRANSFER.createPerHour; i++) rpcTransferCodeCreate(w.ctx('u'), w.logger, w.nk, '{}');
    expect(errCode(() => rpcTransferCodeCreate(w.ctx('u'), w.logger, w.nk, '{}'))).toBe('RATE_LIMITED');
    rpcTransferCodeCreate(w.ctx('other'), w.logger, w.nk, '{}');
  });

  it('refuses an expired code', () => {
    const w = fake();
    const made = JSON.parse(rpcTransferCodeCreate(w.ctx('u'), w.logger, w.nk, '{}')).code.replace('-', '');
    const k = w.key('transfer', made, '00000000-0000-0000-0000-000000000000');
    w.store.get(k)!.value.expiresAt = Date.now() - 1;
    expect(errCode(() => rpcTransferCodeRedeem(w.ctx(), w.logger, w.nk, JSON.stringify({ code: made, steamToken: 't' })))).toBe('CODE_INVALID');
    expect(w.linked.length).toBe(0);
  });

  it('throttles wrong guesses per address, but not other addresses', () => {
    const w = fake();
    const made = JSON.parse(rpcTransferCodeCreate(w.ctx('u'), w.logger, w.nk, '{}')).code;
    const guess = (ip: string, code = 'AAAAAAAA') => errCode(() => rpcTransferCodeRedeem(w.ctx(undefined, ip), w.logger, w.nk, JSON.stringify({ code, steamToken: 't' })));
    for (let i = 0; i < TRANSFER.maxFails; i++) expect(guess('6.6.6.6')).toBe('CODE_INVALID');
    expect(guess('6.6.6.6')).toBe('RATE_LIMITED');
    // Even the right code is refused from the throttled address.
    expect(guess('6.6.6.6', made)).toBe('RATE_LIMITED');
    expect(guess('7.7.7.7', made)).toBe('none');
  });

  it('gives the code back if Steam refuses the ticket, so a retry works', () => {
    const w = fake();
    const made = JSON.parse(rpcTransferCodeCreate(w.ctx('u'), w.logger, w.nk, '{}')).code;
    w.setLinkFails(true);
    expect(errCode(() => rpcTransferCodeRedeem(w.ctx(), w.logger, w.nk, JSON.stringify({ code: made, steamToken: 'bad' })))).toBe('LINK_FAILED');
    expect(w.store.has(w.key('player', 'trade_lock', 'u'))).toBe(false);
    expect(w.notes.length).toBe(0);
    w.setLinkFails(false);
    expect(JSON.parse(rpcTransferCodeRedeem(w.ctx(), w.logger, w.nk, JSON.stringify({ code: made, steamToken: 'good' })))).toEqual({ ok: true });
  });

  it('rejects a malformed redeem request', () => {
    const w = fake();
    for (const body of ['', 'nope', '{}', JSON.stringify({ code: 'ABCDEFGH' }), JSON.stringify({ code: 'short', steamToken: 't' })]) {
      expect(errCode(() => rpcTransferCodeRedeem(w.ctx(), w.logger, w.nk, body))).toBe('BAD_REQUEST');
    }
  });
});
