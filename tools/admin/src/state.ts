// Panel state: the content from the server, compiled with the server's own rules, and thumbnails.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, type AdminContent, type Connection } from './api'
import { checkArt, parsePalette, type ArtReport } from './artCheck'
import { compileContent, type ContentItem, type ContentRuntime } from './content'
import { decodePng } from './images'
import paletteText from '../../../content/palette.hex?raw'

export const PALETTE = parsePalette(paletteText)

export interface Notice {
  kind: 'ok' | 'error'
  text: string
}

export interface Admin {
  conn: Connection
  data: AdminContent
  rt: ContentRuntime
  art: Record<string, string>
  reports: Record<string, ArtReport>
  notice: Notice | null
  busy: boolean
  setNotice: (n: Notice | null) => void
  reload: () => Promise<void>
  /** Runs a save; on success shows `ok` and reloads. Returns false on error. */
  run: (ok: string, fn: (version: string) => Promise<unknown>) => Promise<boolean>
  loadArt: (ids: string[]) => void
  itemById: (id: string) => ContentItem | undefined
}

export function useAdmin(conn: Connection, first: AdminContent): Admin {
  const [data, setData] = useState(first)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [art, setArt] = useState<Record<string, string>>({})
  const [reports, setReports] = useState<Record<string, ArtReport>>({})
  const loaded = useRef<Record<string, string>>({})

  const rt = useMemo(() => compileContent(data.doc), [data])

  const reload = useCallback(async () => {
    setData(await api.content(conn))
  }, [conn])

  const run = useCallback(
    async (ok: string, fn: (version: string) => Promise<unknown>) => {
      setBusy(true)
      try {
        await fn(data.version)
        setNotice({ kind: 'ok', text: ok })
        await reload()
        return true
      } catch (e) {
        const text = e instanceof ApiError && e.code === 'CONTENT_CHANGED' ? 'Başka bir sekme / kişi kaydetmiş. Sayfa yenilendi, değişikliği tekrar yap.' : e instanceof Error ? e.message : String(e)
        setNotice({ kind: 'error', text })
        if (e instanceof ApiError && e.code === 'CONTENT_CHANGED') await reload()
        return false
      } finally {
        setBusy(false)
      }
    },
    [data.version, reload],
  )

  // Thumbnails: fetched once per image hash, in batches.
  const loadArt = useCallback(
    (ids: string[]) => {
      const byId: Record<string, ContentItem> = {}
      for (const it of data.doc.items) byId[it.id] = it
      const want = ids.filter((id) => byId[id]?.art && loaded.current[id] !== byId[id].art!.hash)
      if (want.length === 0) return
      for (const id of want) loaded.current[id] = byId[id].art!.hash
      for (let i = 0; i < want.length; i += 100) {
        api
          .artGet(conn, want.slice(i, i + 100))
          .then(async (r) => {
            setArt((a) => {
              const next = { ...a }
              for (const id in r.art) next[id] = r.art[id].png
              return next
            })
            for (const id in r.art) {
              try {
                const report = checkArt(await decodePng(r.art[id].png), PALETTE)
                setReports((x) => ({ ...x, [id]: report }))
              } catch {
                // unreadable PNG: no report
              }
            }
          })
          .catch(() => {
            for (const id of want) delete loaded.current[id]
          })
      }
    },
    [conn, data],
  )

  useEffect(() => {
    if (!notice || notice.kind !== 'ok') return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  const itemById = useCallback((id: string) => data.doc.items.find((it) => it.id === id), [data])

  return { conn, data, rt, art, reports, notice, busy, setNotice, reload, run, loadArt, itemById }
}
