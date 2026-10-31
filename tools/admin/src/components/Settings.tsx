import { useEffect, useState } from 'react'
import { api } from '../api'
import { generalChance, percent } from '../chance'
import { CATEGORIES, TIERS, type CatchTable, type ChestDef, type QuestDef } from '../content'
import type { Admin } from '../state'
import { CATEGORY_LABEL, TIER_LABEL, Thumb } from './bits'

/** The general drop rates: category weights (10000 = %100) and each item's share. */
export function DropTable({ admin, onOpenItem }: { admin: Admin; onOpenItem: (id: string) => void }) {
  const [table, setTable] = useState<CatchTable>(admin.data.doc.catchTable)
  useEffect(() => setTable(admin.data.doc.catchTable), [admin.data])
  const total = CATEGORIES.reduce((a, c) => a + (table[c] || 0), 0)
  const changed = JSON.stringify(table) !== JSON.stringify(admin.data.doc.catchTable)
  return (
    <div className="cards">
      <section className="card">
        <h2>Av tablosu (kategori ağırlıkları)</h2>
        <p className="muted">Enerjili bir atışta hangi kategorinin geleceği. 10000 = %100. Kıyı / orta / derin çarpanları (config.ts CATCH), yem ve defter şansı bunun üstüne uygulanır. Eşyası olmayan kategori çöpe düşer.</p>
        <table className="list">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Ağırlık</th>
              <th>Oran</th>
              <th>Eşya</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => {
              const n = admin.rt.pool.filter((d) => d.category === c).length
              return (
                <tr key={c}>
                  <td>{CATEGORY_LABEL[c]}</td>
                  <td>
                    <input type="number" min={0} value={table[c] ?? 0} onChange={(e) => setTable({ ...table, [c]: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                  </td>
                  <td>{total > 0 ? percent((table[c] || 0) / total) : ''}</td>
                  <td className={n === 0 && (table[c] || 0) > 0 ? 'lvl-warn' : 'muted'}>{n === 0 && (table[c] || 0) > 0 ? '0 eşya: çöp gelir' : n}</td>
                </tr>
              )
            })}
            <tr>
              <td>
                <b>Toplam</b>
              </td>
              <td>
                <b>{total}</b>
              </td>
              <td colSpan={2} className={total === 10000 ? 'muted' : 'lvl-warn'}>
                {total === 10000 ? '' : 'Toplam 10000 değil; oranlar toplama göre hesaplanır'}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="actions">
          <button className="primary" disabled={!changed || admin.busy} onClick={() => admin.run('Av tablosu kaydedildi, oyunda geçerli', (v) => api.settingsSave(admin.conn, v, { catchTable: table }))}>
            Kaydet
          </button>
          <button className="ghost" disabled={!changed} onClick={() => setTable(admin.data.doc.catchTable)}>
            Geri al
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Eşya başına genel oran</h2>
        <p className="muted">Bir eşyanın oranını değiştirmek için eşyayı aç, "Ağırlık"ı değiştir.</p>
        <table className="list clickable">
          <tbody>
            {admin.rt.pool
              .map((d) => ({ d, ch: generalChance(admin.rt, d.id) }))
              .sort((a, b) => (b.ch?.chance ?? 0) - (a.ch?.chance ?? 0))
              .map(({ d, ch }) => {
                const k = admin.rt.known[d.id]
                const owner = admin.data.doc.items.find((it) => it.id === d.id || it.recipe?.id === d.id)
                return (
                  <tr key={d.id} onClick={() => owner && onOpenItem(owner.id)}>
                    <td>
                      <Thumb png={admin.art[d.id]} tier={k?.tier} size={24} />
                    </td>
                    <td>
                      {k?.name ?? d.id} <span className="muted small">{d.id}</span>
                    </td>
                    <td>{CATEGORY_LABEL[d.category]}</td>
                    <td>{d.weight && d.weight !== 1 ? `×${d.weight}` : ''}</td>
                    <td>{ch ? percent(ch.chance) : ''}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

const stackOptions = (admin: Admin) => Object.values(admin.rt.known).filter((k) => k.type !== 'item')

function StackList({ admin, list, onChange, weighted }: { admin: Admin; list: { defId: string; count: number; weight?: number }[]; onChange: (l: { defId: string; count: number; weight?: number }[]) => void; weighted?: boolean }) {
  return (
    <div className="stacklist">
      {list.map((e, i) => (
        <div key={i} className="input-row">
          <select value={e.defId} onChange={(ev) => onChange(list.map((x, j) => (j === i ? { ...x, defId: ev.target.value } : x)))}>
            {stackOptions(admin).map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.id})
              </option>
            ))}
          </select>
          <label>
            adet <input type="number" min={1} max={99} value={e.count} onChange={(ev) => onChange(list.map((x, j) => (j === i ? { ...x, count: Number(ev.target.value) } : x)))} />
          </label>
          {weighted ? (
            <label>
              ağırlık <input type="number" min={0} value={e.weight ?? 1} onChange={(ev) => onChange(list.map((x, j) => (j === i ? { ...x, weight: Number(ev.target.value) } : x)))} />
            </label>
          ) : null}
          <button className="ghost" onClick={() => onChange(list.filter((_, j) => j !== i))}>
            Kaldır
          </button>
        </div>
      ))}
      <button className="ghost" onClick={() => onChange([...list, { defId: stackOptions(admin)[0]?.id ?? '', count: 1, ...(weighted ? { weight: 1 } : {}) }])}>
        + Ekle
      </button>
    </div>
  )
}

/** Streak chests (day 1..N) and the daily quest list. */
export function ChestsQuests({ admin }: { admin: Admin }) {
  const [chests, setChests] = useState<ChestDef[]>(admin.data.doc.chests)
  const [quests, setQuests] = useState<QuestDef[]>(admin.data.doc.quests)
  useEffect(() => {
    setChests(admin.data.doc.chests)
    setQuests(admin.data.doc.quests)
  }, [admin.data])
  const changed = JSON.stringify(chests) !== JSON.stringify(admin.data.doc.chests) || JSON.stringify(quests) !== JSON.stringify(admin.data.doc.quests)
  const setChest = (i: number, patch: Partial<ChestDef>) => setChests(chests.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const range = (v: [number, number], i: 0 | 1, n: number): [number, number] => (i === 0 ? [n, v[1]] : [v[0], n])

  return (
    <div className="cards">
      <section className="card">
        <h2>Seri sandıkları</h2>
        <p className="muted">Üç günlük görev bitince o günün sandığı açılır; seri gününe göre içerik değişir, son gün en iyisidir. Sandık sadece yığılan şey verir (malzeme, yem, recipe, balık), Float'lı eşya vermez.</p>
        {chests.map((c, i) => (
          <div key={i} className="chest">
            <h3>{i + 1}. gün</h3>
            <div className="row">
              <label>
                Coin <input type="number" min={0} value={c.coin[0]} onChange={(e) => setChest(i, { coin: range(c.coin, 0, Number(e.target.value)) })} /> –{' '}
                <input type="number" min={0} value={c.coin[1]} onChange={(e) => setChest(i, { coin: range(c.coin, 1, Number(e.target.value)) })} />
              </label>
              <label>
                Toz <input type="number" min={0} value={c.dust[0]} onChange={(e) => setChest(i, { dust: range(c.dust, 0, Number(e.target.value)) })} /> –{' '}
                <input type="number" min={0} value={c.dust[1]} onChange={(e) => setChest(i, { dust: range(c.dust, 1, Number(e.target.value)) })} />
              </label>
              <label>
                Çekiliş <input type="number" min={0} max={20} value={c.rolls} onChange={(e) => setChest(i, { rolls: Number(e.target.value) })} />
              </label>
            </div>
            <div className="row top">
              <div className="grow">
                <span className="field-label">Çekiliş havuzu</span>
                <StackList admin={admin} list={c.pool} weighted onChange={(pool) => setChest(i, { pool: pool as ChestDef['pool'] })} />
              </div>
              <div className="grow">
                <span className="field-label">Garanti</span>
                <StackList admin={admin} list={c.guaranteed} onChange={(guaranteed) => setChest(i, { guaranteed })} />
              </div>
            </div>
          </div>
        ))}
        <div className="row">
          <button className="ghost" onClick={() => setChests([...chests, JSON.parse(JSON.stringify(chests[chests.length - 1]))])}>
            + Gün ekle
          </button>
          <button className="ghost" disabled={chests.length <= 1} onClick={() => setChests(chests.slice(0, -1))}>
            Son günü kaldır
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Günlük görev listesi</h2>
        <p className="muted">Her gün bu listeden 3 görev seçilir. Görevin yazısı client'ta id'ye göre gösterilir. Listeden çıkan görev, o gün alan oyuncuda yapılmış sayılır.</p>
        <table className="list">
          <thead>
            <tr>
              <th>id</th>
              <th>Olay</th>
              <th>Hedef</th>
              <th>En az Tier</th>
              <th>En düşük level</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quests.map((q, i) => {
              const setQ = (patch: Partial<QuestDef>) => setQuests(quests.map((x, j) => (j === i ? { ...x, ...patch } : x)))
              return (
                <tr key={i}>
                  <td>
                    <input value={q.id} onChange={(e) => setQ({ id: e.target.value })} />
                  </td>
                  <td>
                    <select value={q.event} onChange={(e) => setQ({ event: e.target.value as QuestDef['event'] })}>
                      {['catch', 'catch_tier', 'sell', 'craft', 'merge', 'trade', 'emote'].map((ev) => (
                        <option key={ev} value={ev}>
                          {ev}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="number" min={1} value={q.target} onChange={(e) => setQ({ target: Number(e.target.value) })} />
                  </td>
                  <td>
                    <select value={q.minTier ?? ''} disabled={q.event !== 'catch_tier'} onChange={(e) => setQ({ minTier: e.target.value || undefined })}>
                      <option value="">—</option>
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {TIER_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="number" min={1} value={q.minLevel ?? ''} onChange={(e) => setQ({ minLevel: e.target.value ? Number(e.target.value) : undefined })} />
                  </td>
                  <td>
                    <button className="ghost" onClick={() => setQuests(quests.filter((_, j) => j !== i))}>
                      Kaldır
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button className="ghost" onClick={() => setQuests([...quests, { id: `quest_${quests.length + 1}`, event: 'catch', target: 5 }])}>
          + Görev ekle
        </button>
      </section>
      <div className="actions sticky">
        <button className="primary" disabled={!changed || admin.busy} onClick={() => admin.run('Sandıklar ve görevler kaydedildi', (v) => api.settingsSave(admin.conn, v, { chests, quests }))}>
          Sandıkları ve görevleri kaydet
        </button>
        <button
          className="ghost"
          disabled={!changed}
          onClick={() => {
            setChests(admin.data.doc.chests)
            setQuests(admin.data.doc.quests)
          }}
        >
          Geri al
        </button>
      </div>
    </div>
  )
}
