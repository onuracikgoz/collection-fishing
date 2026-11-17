import { useMemo, useState } from 'react'
import { api } from '../api'
import type { WardrobeColor, WardrobeItem, WardrobePart } from '../../../../server/src/rules/wardrobe'
import type { Admin } from '../state'
import { TIER_LABEL } from './bits'

const SOURCE_LABEL: Record<string, string> = { admin: 'Panel', craft: 'Craft', rent_coin: 'Coin kirası', rent_diamond: 'Elmas kirası' }

interface PlayerView {
  userId: string
  username: string
  items: WardrobeItem[]
  look: { body: string; parts: { part: string; color: string; rented?: boolean }[] }
  worn: { slot: string; instanceId: string }[]
}

function colorsFor(colors: WardrobeColor[], kinds: string[], effects: string[] = []) {
  return colors.filter((c) => kinds.includes(c.kind) || effects.includes(c.id))
}

/** One player's wardrobe: find, see, give, take back (Items tab, Diğer). */
export function PlayerWardrobe({ admin }: { admin: Admin }) {
  const cat = admin.data.doc.wardrobe ?? { parts: [], colors: [] }
  const partById = useMemo(() => Object.fromEntries(cat.parts.map((p) => [p.id, p])), [cat])
  const [query, setQuery] = useState('')
  const [player, setPlayer] = useState<PlayerView | null>(null)
  const [busy, setBusy] = useState(false)
  const [partId, setPartId] = useState('')
  const [color, setColor] = useState('')
  const [color2, setColor2] = useState('')
  const [days, setDays] = useState(0)
  const [locked, setLocked] = useState(false)
  const part = partById[partId] as WardrobePart | undefined

  const call = async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | null> => {
    setBusy(true)
    try {
      const r = await fn()
      if (ok) admin.setNotice({ kind: 'ok', text: ok })
      return r
    } catch (e) {
      admin.setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
      return null
    } finally {
      setBusy(false)
    }
  }
  const load = async (who = query) => {
    const r = await call(() => api.wardrobeGet(admin.conn, who.trim()))
    if (r) setPlayer(r as PlayerView)
  }
  const give = async () => {
    if (!player || !part) return
    const r = await call(
      () => api.wardrobeGive(admin.conn, { player: player.userId, part: part.id, color, color2: color2 || undefined, days: days > 0 ? days : undefined, locked }),
      `${part.name} ${player.username} oyuncusuna verildi${days > 0 ? ` (${days} gün)` : ''}`,
    )
    if (r) load(player.userId)
  }
  const take = async (it: WardrobeItem) => {
    if (!player) return
    const r = await call(() => api.wardrobeTake(admin.conn, player.userId, it.instanceId), `${partById[it.part]?.name ?? it.part} geri alındı`)
    if (r) load(player.userId)
  }
  const pickPart = (id: string) => {
    setPartId(id)
    const p = partById[id] as WardrobePart | undefined
    setColor(p ? (colorsFor(cat.colors, p.colors, p.effects)[0]?.id ?? '') : '')
    setColor2(p?.color2 ? (colorsFor(cat.colors, p.color2)[0]?.id ?? '') : '')
  }
  const wornIds = new Set(player?.worn.map((w) => w.instanceId) ?? [])
  const tierOf = (it: { part: string; color: string }) => (it.color.startsWith('fx_') ? 'mythic' : (partById[it.part]?.tier ?? null))

  return (
    <section className="card side">
      <h2>Oyuncunun gardırobu</h2>
      <div className="row">
        <input className="grow" placeholder="Kullanıcı adı ya da id" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="primary" disabled={busy || !query.trim()} onClick={() => load()}>
          Bul
        </button>
      </div>
      {player ? (
        <>
          <p>
            <b>{player.username}</b> <span className="muted small">{player.userId}</span>
            <br />
            <span className="small muted">
              Gövde {player.look.body} · giyili: {player.look.parts.map((p) => partById[p.part]?.name ?? p.part).join(', ') || 'yok'}
            </span>
          </p>
          <h3>Eşyaları ({player.items.length})</h3>
          {player.items.length === 0 ? <p className="muted small">Gardırop boş (sadece bedava parçalar).</p> : null}
          <ul className="setlist">
            {player.items.map((it) => {
              const t = tierOf(it)
              return (
                <li key={it.instanceId}>
                  <span className="grow">
                    <b>{partById[it.part]?.name ?? it.part}</b> <span className={`tiertext tier-${t ?? 'none'}`}>{t ? TIER_LABEL[t] : ''}</span>
                    {wornIds.has(it.instanceId) ? <span className="tag live">Giyili</span> : null}
                    <div className="muted small">
                      {it.color || 'sabit renk'}
                      {it.color2 ? ` + ${it.color2}` : ''} · {SOURCE_LABEL[it.source] ?? it.source}
                      {it.until ? ` · bitiş ${new Date(it.until).toLocaleString('tr-TR')}` : ' · kalıcı'}
                      {it.locked ? ' · kilitli' : ''}
                    </div>
                  </span>
                  <button className="ghost" disabled={busy} onClick={() => take(it)}>
                    Geri al
                  </button>
                </li>
              )
            })}
          </ul>
          <h3>Parça ver</h3>
          <label className="field">
            <span className="field-label">Parça</span>
            <select value={partId} onChange={(e) => pickPart(e.target.value)}>
              <option value="">Seç…</option>
              {cat.parts
                .filter((p) => p.active && !p.free)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.family} · {p.name} ({p.tier ? TIER_LABEL[p.tier] : ''})
                  </option>
                ))}
            </select>
          </label>
          {part ? (
            <>
              <label className="field">
                <span className="field-label">Renk</span>
                <select value={color} onChange={(e) => setColor(e.target.value)}>
                  {part.colors.length === 0 ? <option value="">Sabit renk</option> : null}
                  {colorsFor(cat.colors, part.colors, part.effects).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} {c.kind === 'fx' ? '(Mythic)' : c.tier ? `(${TIER_LABEL[c.tier]})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {part.color2 ? (
                <label className="field">
                  <span className="field-label">İkinci renk</span>
                  <select value={color2} onChange={(e) => setColor2(e.target.value)}>
                    {colorsFor(cat.colors, part.color2).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="field">
                <span className="field-label">Süre (gün, 0 = kalıcı)</span>
                <input type="number" min={0} max={365} value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))} />
                <span className="field-hint">Süreli parça her zaman kilitlidir ve süresi bitince silinir.</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={locked || days > 0} disabled={days > 0} onChange={(e) => setLocked(e.target.checked)} /> Kilitli (takas ve pazara girmez)
              </label>
              <div className="row">
                <button className="primary" disabled={busy} onClick={give}>
                  Ver
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <p className="muted small">Test ve destek için: oyuncuya parça ver ya da geri al. Oyuncu oyundaysa değişiklik hemen görünür.</p>
      )}
    </section>
  )
}
