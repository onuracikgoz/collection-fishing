import { useState } from 'react'
import { api, type AdminContent, type Connection } from './api'
import { useAdmin } from './state'
import { Items } from './components/Items'
import { JsonTab } from './components/JsonTab'
import { Queue } from './components/Queue'
import { Translations } from './components/Translations'
import { Sets } from './components/Sets'
import { ChestsQuests, DropTable } from './components/Settings'

const STORE = 'collection-admin/connection'

function savedConnection(): Connection {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || '')
    if (v && typeof v.host === 'string' && typeof v.httpKey === 'string') return v
  } catch {
    // first visit
  }
  return { host: 'http://127.0.0.1:7350', httpKey: 'defaulthttpkey' }
}

export function App() {
  const [conn, setConn] = useState<Connection>(savedConnection)
  const [first, setFirst] = useState<AdminContent | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      const c = await api.content(conn)
      try {
        localStorage.setItem(STORE, JSON.stringify(conn))
      } catch {
        // private window
      }
      setFirst(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (first) return <Panel conn={conn} first={first} />
  return (
    <div className="login">
      <h1>CollectionGame Admin</h1>
      <p className="muted">Nakama'ya sunucu anahtarıyla (runtime.http_key) bağlanır. Yerelde varsayılan anahtar <code>defaulthttpkey</code>. Canlı sunucunun anahtarını kimseyle paylaşma.</p>
      <label className="field">
        <span className="field-label">Nakama adresi</span>
        <input value={conn.host} onChange={(e) => setConn({ ...conn, host: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">http_key</span>
        <input type="password" value={conn.httpKey} onChange={(e) => setConn({ ...conn, httpKey: e.target.value })} />
      </label>
      <button className="primary" disabled={busy} onClick={connect}>
        {busy ? 'Bağlanıyor…' : 'Bağlan'}
      </button>
      {error ? <p className="lvl-error">{error}</p> : null}
    </div>
  )
}

const TABS = [
  ['queue', 'Onay kuyruğu'],
  ['items', 'Eşyalar'],
  ['sets', 'Setler'],
  ['drops', 'Düşme oranları'],
  ['chests', 'Sandıklar ve görevler'],
  ['texts', 'Çeviriler'],
  ['dev', 'Geliştirici'],
  ['json', 'JSON'],
] as const
type Tab = (typeof TABS)[number][0]

function Panel({ conn, first }: { conn: Connection; first: AdminContent }) {
  const admin = useAdmin(conn, first)
  const [tab, setTab] = useState<Tab>('queue')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const drafts = admin.data.doc.items.filter((it) => it.status === 'draft').length
  const openOne = (id: string) => {
    setOpenItem(id)
    setTab('items')
  }

  return (
    <div className="app">
      <header>
        <h1>CollectionGame Admin</h1>
        <nav>
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => (setTab(id), id === 'items' && setOpenItem(null))}>
              {label}
              {id === 'queue' && drafts > 0 ? <span className="badge">{drafts}</span> : null}
            </button>
          ))}
        </nav>
        <span className="muted small">
          {conn.host} · {admin.data.stored ? 'kayıtlı içerik' : 'başlangıç içeriği (henüz kayıt yok)'}
        </span>
        <button className="ghost" onClick={() => admin.reload()}>
          Yenile
        </button>
      </header>
      {admin.notice ? (
        <div className={`notice ${admin.notice.kind}`} onClick={() => admin.setNotice(null)}>
          {admin.notice.text.split('\n').map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      ) : null}
      <main>
        {tab === 'queue' ? <Queue admin={admin} /> : null}
        {tab === 'items' ? <Items admin={admin} openId={openItem} onOpen={setOpenItem} /> : null}
        {tab === 'sets' ? <Sets admin={admin} onOpenItem={openOne} /> : null}
        {tab === 'drops' ? <DropTable admin={admin} onOpenItem={openOne} /> : null}
        {tab === 'chests' ? <ChestsQuests admin={admin} /> : null}
        {tab === 'texts' ? <Translations admin={admin} /> : null}
        {tab === 'dev' ? <DevDashboard /> : null}
        {tab === 'json' ? <JsonTab admin={admin} /> : null}
      </main>
    </div>
  )
}

/** The dev dashboard (test players, give items, live view), served by this dev server under /dev/. It keeps its own login. */
function DevDashboard() {
  return (
    <>
      <p className="muted small">
        Test oyuncuları, eşya verme, sunucu izleme. Yalnızca <code>DEV_TOOLS</code> açık (yerel / test) sunucuda çalışır; canlıda bu sekme bağlanamaz. Ayrı pencerede aç: <a href="/dev/" target="_blank" rel="noreferrer">/dev/</a>
      </p>
      <iframe title="Dev dashboard" src="/dev/" style={{ width: '100%', height: 'calc(100vh - 150px)', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
    </>
  )
}
