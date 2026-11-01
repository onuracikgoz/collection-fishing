// Language texts: pure checks, get_locale and the admin RPCs against a fake Nakama.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { rpcAdminLocaleGet, rpcAdminLocaleSave } from '../src/admin/rpc';
import { rpcGetLocale } from '../src/rpc/getLocale';
import { canonical, isLang, placeholders, samePlaceholders, validateStrings } from '../src/rules/locale';

function fake() {
  const store = new Map<string, { value: any; version: number }>();
  let version = 0;
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const nk: any = {
    storageRead: (reqs: any[]) =>
      reqs
        .filter((r) => store.has(key(r.collection, r.key, r.userId)))
        .map((r) => ({ ...r, value: JSON.parse(JSON.stringify(store.get(key(r.collection, r.key, r.userId))!.value)), version: String(store.get(key(r.collection, r.key, r.userId))!.version) })),
    storageWrite: (writes: any[]) =>
      writes.map((w) => {
        const k = key(w.collection, w.key, w.userId);
        const cur = store.get(k);
        if (w.version === '*' && cur) throw new Error('exists');
        if (w.version && w.version !== '*' && (!cur || String(cur.version) !== w.version)) throw new Error('version');
        store.set(k, { value: JSON.parse(JSON.stringify(w.value)), version: ++version });
        return { version: String(version) };
      }),
    sha256Hash: (s: string) => createHash('sha256').update(s).digest('hex'),
  };
  const logger: any = { warn: () => undefined, error: () => undefined, info: () => undefined };
  const admin: any = { userId: '' };
  const player: any = { userId: '11111111-1111-1111-1111-111111111111' };
  const call = (fn: any, body: object, ctx = admin) => JSON.parse(fn(ctx, logger, nk, JSON.stringify(body)));
  return { call, admin, player };
}

const errOf = (fn: () => unknown): { code: string; message: string } => {
  try {
    fn();
  } catch (e: any) {
    return JSON.parse(e.message);
  }
  return { code: 'none', message: '' };
};

describe('locale rules', () => {
  it('knows the languages and checks the strings', () => {
    expect(isLang('pt-BR')).toBe(true);
    expect(isLang('xx')).toBe(false);
    expect(validateStrings({ 'settings.language': 'Language', 'a_b-c': 'x' })).toEqual([]);
    expect(validateStrings({ 'Bad Key': 'x' })[0]).toMatch(/lower case/);
    expect(validateStrings({ ok: 5 })[0]).toMatch(/must be a string/);
    expect(validateStrings([])[0]).toMatch(/object/);
  });
  it('compares placeholders and hashes the same strings the same way', () => {
    expect(placeholders('{count} x {name} {count}')).toEqual(['count', 'name']);
    expect(samePlaceholders('{a} {b}', '{b} ve {a}')).toBe(true);
    expect(samePlaceholders('{a}', 'none')).toBe(false);
    expect(canonical({ b: '1', a: '2' })).toBe(canonical({ a: '2', b: '1' }));
  });
});

describe('locale RPCs', () => {
  it('refuse player sessions on admin RPCs', () => {
    const w = fake();
    expect(errOf(() => w.call(rpcAdminLocaleGet, {}, w.player)).code).toBe('NOT_ALLOWED');
    expect(errOf(() => w.call(rpcAdminLocaleSave, { lang: 'de', strings: {} }, w.player)).code).toBe('NOT_ALLOWED');
  });

  it('saves a language and serves it with a hash that lets the client skip a download', () => {
    const w = fake();
    expect(w.call(rpcGetLocale, { lang: 'de' }, w.player)).toEqual({ lang: 'de', hash: '', strings: {} });
    const saved = w.call(rpcAdminLocaleSave, { lang: 'de', version: '', strings: { 'ui.ok': 'OK', 'ui.empty': '  ' } });
    expect(saved.keys).toBe(1);
    const got = w.call(rpcGetLocale, { lang: 'de' }, w.player);
    expect(got).toEqual({ lang: 'de', hash: saved.hash, strings: { 'ui.ok': 'OK' } });
    expect(w.call(rpcGetLocale, { lang: 'de', hash: saved.hash }, w.player)).toEqual({ lang: 'de', hash: saved.hash });
    expect(w.call(rpcGetLocale, { lang: 'de', hash: 'old' }, w.player).strings).toEqual({ 'ui.ok': 'OK' });
    const all = w.call(rpcAdminLocaleGet, {});
    expect(Object.keys(all.langs)).toHaveLength(11);
    expect(all.langs.de.version).toBe(saved.version);
    expect(all.langs.tr.strings).toEqual({});
  });

  it('refuses a stale version, unknown languages and bad strings', () => {
    const w = fake();
    w.call(rpcAdminLocaleSave, { lang: 'tr', version: '', strings: { a: 'x' } });
    expect(errOf(() => w.call(rpcAdminLocaleSave, { lang: 'tr', version: '', strings: { a: 'y' } })).code).toBe('CONTENT_CHANGED');
    expect(errOf(() => w.call(rpcAdminLocaleSave, { lang: 'xx', strings: {} })).code).toBe('BAD_REQUEST');
    expect(errOf(() => w.call(rpcAdminLocaleSave, { lang: 'en', strings: { 'Bad Key': 'x' } })).code).toBe('LOCALE_INVALID');
    expect(errOf(() => w.call(rpcGetLocale, { lang: 'xx' }, w.player)).code).toBe('BAD_REQUEST');
  });
});
