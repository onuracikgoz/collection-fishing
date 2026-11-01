// Language overrides in storage: one object per language under the system user (`locale/<lang>`).
import { Lang, Strings, canonical } from '../rules/locale';
import { SYSTEM_USER } from './content';

export const LOCALE_COLLECTION = 'locale';
const READ_NONE = 0 as nkruntime.ReadPermissionValues;
const WRITE_NONE = 0 as nkruntime.WritePermissionValues;

export interface StoredLocale {
  strings: Strings;
  hash: string;
  updatedAt: number;
  /** Storage version, '' when nothing is stored for the language. */
  version: string;
}

export function readLocale(nk: nkruntime.Nakama, lang: Lang): StoredLocale {
  const objs = nk.storageRead([{ collection: LOCALE_COLLECTION, key: lang, userId: SYSTEM_USER }]);
  if (objs.length === 0) return { strings: {}, hash: '', updatedAt: 0, version: '' };
  const v = objs[0].value as { strings?: Strings; hash?: string; updatedAt?: number };
  return { strings: v.strings || {}, hash: v.hash || '', updatedAt: v.updatedAt || 0, version: objs[0].version };
}

/** Replaces the language's strings; throws if the stored version moved (two tabs). */
export function writeLocale(nk: nkruntime.Nakama, lang: Lang, strings: Strings, version: string, now = Date.now()): StoredLocale {
  const hash = nk.sha256Hash(canonical(strings)).slice(0, 16);
  const acks = nk.storageWrite([
    {
      collection: LOCALE_COLLECTION,
      key: lang,
      userId: SYSTEM_USER,
      value: { strings, hash, updatedAt: now } as unknown as { [key: string]: unknown },
      permissionRead: READ_NONE,
      permissionWrite: WRITE_NONE,
      version: version === '' ? '*' : version,
    },
  ]);
  return { strings, hash, updatedAt: now, version: acks[0].version };
}
