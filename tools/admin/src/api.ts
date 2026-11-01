// Calls the server's admin_* RPCs with the runtime http_key (server-to-server; no player session).
// Nakama: POST /v2/rpc/<id>?http_key=<key>&unwrap, body = the payload as is.
import type { ContentDoc } from './content'

export interface Connection {
  host: string
  httpKey: string
}

export interface AdminContent {
  version: string
  stored: boolean
  doc: ContentDoc
  errors: string[]
  waters: string[]
  maxLevel: number
  artMaxBytes: number
}

export interface StoredArt {
  png: string
  hash: string
  w: number
  h: number
}

export interface LocaleLang {
  version: string
  hash: string
  updatedAt: number
  strings: Record<string, string>
}

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function rpc<T>(conn: Connection, id: string, body: object = {}): Promise<T> {
  const url = `${conn.host.replace(/\/+$/, '')}/v2/rpc/${id}?http_key=${encodeURIComponent(conn.httpKey)}&unwrap`
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new ApiError('NETWORK', `Sunucuya ulaşılamadı (${conn.host}). Nakama açık mı?`)
  }
  const text = await res.text()
  if (!res.ok) {
    // Nakama: { code, message }; our message is itself JSON { code, message }.
    let code = String(res.status)
    let message = text
    try {
      const outer = JSON.parse(text) as { message?: string }
      message = outer.message ?? text
      const inner = JSON.parse(message) as { code?: string; message?: string }
      code = inner.code ?? code
      message = inner.message ?? message
    } catch {
      // plain text
    }
    if (res.status === 401) message = 'http_key yanlış (Nakama runtime.http_key).'
    throw new ApiError(code, message)
  }
  return (text ? JSON.parse(text) : {}) as T
}

export const api = {
  content: (c: Connection) => rpc<AdminContent>(c, 'admin_content'),
  artGet: (c: Connection, ids: string[]) => rpc<{ art: Record<string, StoredArt> }>(c, 'admin_art_get', { ids }),
  itemSave: (c: Connection, version: string, item: object) => rpc<{ version: string }>(c, 'admin_item_save', { version, item }),
  itemDelete: (c: Connection, version: string, id: string) => rpc<{ version: string }>(c, 'admin_item_delete', { version, id }),
  setSave: (c: Connection, version: string, set: object) => rpc<{ version: string }>(c, 'admin_set_save', { version, set }),
  settingsSave: (c: Connection, version: string, body: object) => rpc<{ version: string }>(c, 'admin_settings_save', { version, ...body }),
  artPut: (c: Connection, version: string, body: { id: string; png: string; setId?: string; tier?: string; type?: string }) =>
    rpc<{ version: string; created: boolean }>(c, 'admin_art_put', { version, ...body }),
  localeGet: (c: Connection) => rpc<{ langs: Record<string, LocaleLang> }>(c, 'admin_locale_get'),
  localeSave: (c: Connection, lang: string, version: string, strings: Record<string, string>) =>
    rpc<{ version: string; hash: string; keys: number }>(c, 'admin_locale_save', { lang, version, strings }),
  import: (c: Connection, version: string, body: object) => rpc<{ version: string; added: number; updated: number; skipped: string[] }>(c, 'admin_import', { version, ...body }),
}
