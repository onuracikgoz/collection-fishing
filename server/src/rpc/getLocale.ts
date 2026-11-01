// get_locale: the server's texts for one language (docs/protokol.md, Dil). The client merges them
// over the texts in its build; with an unchanged hash it gets no strings and keeps its cache.
import { readLocale } from '../match/locale';
import { ErrorCode, errorMessage } from '../protocol';
import { isLang } from '../rules/locale';
import { rpcLimit } from './limit';

export function rpcGetLocale(ctx: nkruntime.Context, _logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  rpcLimit(nk, ctx.userId, 'get_locale');
  if (!ctx.userId) throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'no user'), code: 16 } as nkruntime.Error;
  let body: { lang?: unknown; hash?: unknown } = {};
  try {
    body = JSON.parse(payload || '{}') as typeof body;
  } catch (_e) {
    body = {};
  }
  if (!isLang(body.lang)) throw { message: errorMessage(ErrorCode.BAD_REQUEST, 'unknown language'), code: 3 } as nkruntime.Error;
  const loc = readLocale(nk, body.lang);
  if (typeof body.hash === 'string' && body.hash !== '' && body.hash === loc.hash) return JSON.stringify({ lang: body.lang, hash: loc.hash });
  return JSON.stringify({ lang: body.lang, hash: loc.hash, strings: loc.strings });
}
