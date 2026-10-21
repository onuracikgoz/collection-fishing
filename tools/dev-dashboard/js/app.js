// Dev dashboard entry: connection, tabs and the shared app state.
import { Conn, Session } from './nakama.js';
import { Grid, OP, Player } from './player.js';
import { act, badge, button, card, field, h, input, jsonView, mount, row, select, store, table } from './ui.js';
import { rpcTemplates } from './templates.js';
import { renderPlayers } from './tab-players.js';
import { renderPlay } from './tab-play.js';
import { renderMessages } from './tab-messages.js';
import { renderSim } from './tab-sim.js';

const ADMIN_DEVICE = 'cg-dev-dashboard-admin-device';
const ADMIN_NAME = 'dev_admin';

export const app = {
  conn: new Conn(store('conn') || {}),
  admin: null,
  info: null,
  grid: null,
  opCodes: OP,
  players: [],
  current: null,
  inspect: store('inspect') || null,
  logMoves: false,
  logSnapshots: false,
  log: [],
  logListeners: new Set(),
  tab: store('tab') || 'overview',
  onLog(_p, entry) {
    this.log.push(entry);
    if (this.log.length > 4000) this.log.splice(0, this.log.length - 4000);
    for (const l of this.logListeners) l(entry);
  },
  savePlayers() {
    store('players', this.players.map((p) => ({ deviceId: p.deviceId, username: p.wantedName })));
  },
  addPlayer(deviceId, username) {
    let p = this.players.find((x) => x.deviceId === deviceId);
    if (!p) {
      p = new Player(this, { deviceId, username });
      this.players.push(p);
      this.savePlayers();
    }
    this.current = p;
    return p;
  },
  removePlayer(p) {
    p.disconnect();
    this.players = this.players.filter((x) => x !== p);
    if (this.current === p) this.current = this.players[0] || null;
    this.savePlayers();
  },
  /** Opens a player in the inspector tab. */
  inspectUser(userId) {
    this.inspect = userId;
    store('inspect', userId);
    show('players');
  },
  render: () => render(),
};
window.devApp = app; // handy in the browser console

const TABS = [
  ['overview', 'Genel'],
  ['players', 'Oyuncular'],
  ['play', 'Oyna'],
  ['messages', 'Mesajlar'],
  ['rpc', 'RPC'],
  ['sim', 'Simülasyon'],
  ['config', 'Yapılandırma'],
];

const isLocalHost = (host) => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(host);

// --- connection ---

async function connect() {
  const c = app.conn;
  store('conn', { host: c.host, port: c.port, ssl: c.ssl, serverKey: c.serverKey });
  if (!(await c.healthcheck().catch(() => false))) throw new Error(`Nakama'ya ulaşılamadı: ${c.base} (docker compose up -d)`);
  app.admin = await c.authenticateDevice(ADMIN_DEVICE, ADMIN_NAME);
  try {
    app.info = await app.admin.rpc('dev_info');
  } catch (e) {
    app.info = null;
    if (e.code === 'DEV_TOOLS_OFF') throw new Error('Bu sunucuda geliştirici araçları kapalı (DEV_TOOLS yok). Dashboard sadece yerel geliştirme sunucusunda çalışır.');
    throw e;
  }
  app.opCodes = app.info.opCodes || OP;
  app.grid = new Grid(app.info.map);
  // Remembered test players come back (not logged in until used).
  for (const p of store('players') || []) if (!app.players.find((x) => x.deviceId === p.deviceId)) app.players.push(new Player(app, p));
  if (!app.current) app.current = app.players[0] || null;
}

// --- tabs ---

const main = h('main');
const nav = h('nav');
const status = h('div', { class: 'status' });

export function show(tab) {
  app.tab = tab;
  store('tab', tab);
  render();
}

function renderNav() {
  mount(
    nav,
    h('div', { class: 'brand' }, 'CollectionGame', h('small', null, 'dev dashboard')),
    TABS.map(([id, label]) => h('button', { class: app.tab === id ? 'active' : '', onclick: () => show(id), disabled: !app.info && id !== 'overview' ? true : undefined }, label)),
  );
  const c = app.conn;
  mount(
    status,
    app.info ? badge(`bağlı: ${c.host}:${c.port}`, 'ok') : badge('bağlı değil', 'bad'),
    app.info && !isLocalHost(c.host) ? badge('UYARI: yerel olmayan sunucu', 'bad') : null,
    app.players.filter((p) => p.online).length ? badge(`${app.players.filter((p) => p.online).length} oyuncu oyunda`, 'muted') : null,
  );
}

let cleanup = null;
function render() {
  renderNav();
  if (cleanup) cleanup();
  cleanup = null;
  const area = h('div', { class: 'tab' });
  mount(main, area);
  const r = {
    overview: renderOverview,
    players: renderPlayers,
    play: renderPlay,
    messages: renderMessages,
    rpc: renderRpc,
    sim: renderSim,
    config: renderConfig,
  }[app.tab];
  cleanup = (app.info || app.tab === 'overview' ? r : renderOverview)(area, app) || null;
}

// --- overview ---

const FEATURES = [
  ['Giriş, kullanıcı adı kuralı', 'var', 'Oyna → Yeni oyuncu; geçersiz adı da dene'],
  ['Sunucu listesi, katılım, sürüm kontrolü', 'var', 'Oyna → Sunucuya gir; Mesajlar → yanlış protocolVersion'],
  ['Hareket, hız sınırı, çarpışma, CORRECTION', 'var', 'Oyna → haritaya tıkla; Mesajlar → MOVE hile şablonu'],
  ['Yakınlık (görüş alanı), chat balonu, hız sınırı', 'var', 'İki test oyuncusuyla Oyna'],
  ['Balık tutma: atış, bekleme, kıpırdama, vuruş, çekme', 'var', 'Oyna → Balık tutma; dev: hemen vur / av seç'],
  ['Drop tablosu, bant, Tier, Float', 'var', 'Simülasyon → Av tablosu'],
  ['Çanta (40 kutu, yığın 99), BAG_FULL', 'var', 'Oyuncular → Senaryo: çantayı doldur'],
  ['Enerji, 0 enerjide çöp, çevrimdışı dolum', 'var', 'Oyuncular → Enerji'],
  ['Temel yem', 'var', 'Her atış temel yemle'],
  ['Özel yemler', 'yok', 'Başka thread yazıyor (Faz 4); gelince RPC/Mesajlar ile denenir'],
  ['Olta dayanıklılığı ve tamir', 'yok', 'Başka thread yazıyor (Faz 4)'],
  ['Depo', 'yok', 'Başka thread yazıyor (Faz 4)'],
  ['Collection Book: 3 durum, yeni keşif, yuva değiştirme', 'var', 'Oyuncular → Defter; Mesajlar → FISH_END keşif şablonu'],
  ['Şans bonusu, Collection Score', 'var', 'Oyuncular → Defter (sayfa doldur)'],
  ['Profil kartı, showcase, Arıyorum', 'var', 'Oyuncular → Profil'],
  ['Arkadaşlar, Yanına git, near ile katılım', 'var', 'Oyuncular → Arkadaşlar; Oyna → Arkadaşlar'],
  ['Emote, show_fish', 'var', 'Oyna → Emote'],
  ['Coin, NPC satış, toz (parçalama)', 'var', 'Oyna → Çanta → Sat / Parçala'],
  ['Birleştirme (3\'ü 1)', 'var', 'Oyuncular → Senaryo: birleştirmeye hazır'],
  ['Recipe ve craft, kalite şansı', 'var', 'Oyna → Çanta → Craft; Simülasyon → Craft kalitesi'],
  ['XP ve Level', 'yok', 'Sunucuda henüz yok (docs/tasarim/04-xp-level.md)'],
  ['Takas penceresi, pazar panosu, alım ilanı', 'yok', 'Faz 5'],
  ['Whisper, moderasyon, bot önlemleri', 'yok', 'Faz 5'],
  ['Günlük görev, sandık, seri', 'yok', 'Faz 6'],
  ['Kozmetik mağaza', 'yok', 'Faz 7'],
];

function renderOverview(area) {
  const c = app.conn;
  const conn = card(
    'Bağlantı',
    row(
      field('Host', input({ value: c.host, onchange: (e) => (c.host = e.target.value.trim()) })),
      field('Port', input({ value: c.port, size: 6, onchange: (e) => (c.port = e.target.value.trim()) })),
      field('Server key', input({ value: c.serverKey, onchange: (e) => (c.serverKey = e.target.value.trim()) })),
      field('SSL', input({ type: 'checkbox', checked: c.ssl, onchange: (e) => (c.ssl = e.target.checked) })),
      button('Bağlan', () => act(connect, 'Bağlandı').then(render), 'primary'),
    ),
    h('p', { class: 'muted' }, `Yerel sunucu: docker compose up -d. Dashboard bir "${ADMIN_NAME}" hesabıyla giriş yapar ve dev_* RPC'lerini çağırır; bunlar sadece DEV_TOOLS=true olan sunucuda çalışır.`),
    app.info ? row(badge(`protocolVersion ${app.info.protocolVersion}`), badge(`node ${app.info.node}`), badge('DEV_TOOLS açık', 'ok'), badge(`sunucu saati ${new Date(app.info.serverTime).toLocaleTimeString()}`)) : null,
    !isLocalHost(c.host) ? h('p', { class: 'warn' }, 'Bu host yerel ağ değil. Dashboard sadece geliştirme sunucusu içindir; test ve canlı sunucuda dev_* RPC\'leri kapalıdır.') : null,
  );
  const world = h('div');
  const loadWorld = () =>
    act(async () => {
      const w = await app.admin.rpc('dev_world');
      mount(
        world,
        w.servers.length === 0 ? h('p', { class: 'muted' }, 'Açık dünya maçı yok.') : null,
        w.servers.map((s) =>
          h(
            'div',
            { class: 'sub' },
            h('h4', null, `${s.serverName} `, badge(`${s.players.length} oyuncu`), h('code', { class: 'muted' }, s.matchId)),
            s.players.length
              ? table(
                  ['Oyuncu', 'Konum', 'Enerji', 'Çanta', 'Defter', 'Balık', 'Görüyor', ''],
                  s.players.map((p) => [
                    p.name,
                    `${p.x.toFixed(1)}, ${p.y.toFixed(1)} ${p.moving ? '🚶' : ''}`,
                    p.energy,
                    `${p.bag.items} eşya, ${Object.keys(p.bag.stacks).length} yığın`,
                    p.bookRecords,
                    p.fish ? `${p.fish.phase} ${p.fish.band}${p.fish.roll ? ' → ' + p.fish.roll.defId : ''}` : '',
                    p.sees.length,
                    button('İncele', () => app.inspectUser(p.userId)),
                  ]),
                )
              : null,
          ),
        ),
      );
    });
  const worldCard = card('Dünya (canlı)', row(button('Yenile', loadWorld)), world);
  const features = card(
    'Özellik durumu',
    h('p', { class: 'muted' }, 'Tasarım dokümanlarına göre sunucuda olanlar ve dashboard\'da nerede denendiği. "yok" olanlar gelince RPC ve Mesajlar sekmeleriyle hemen denenebilir.'),
    table(['Özellik', 'Sunucu', 'Nerede test edilir'], FEATURES.map(([f, s, w]) => [f, badge(s, s === 'var' ? 'ok' : 'muted'), w])),
  );
  mount(area, conn, app.info ? worldCard : null, features);
  if (app.info) loadWorld();
}

// --- RPC console ---

const rpcHistory = [];
function renderRpc(area) {
  const templates = rpcTemplates({ targetId: app.inspect, otherId: app.players.find((p) => p.userId && p.userId !== app.inspect)?.userId });
  const sessions = [['admin', `${ADMIN_NAME} (dashboard)`], ...app.players.filter((p) => p.session).map((p, i) => [String(i), p.label])];
  let who = 'admin';
  const name = input({ value: 'dev_player', list: 'rpc-names', style: { width: '18em' } });
  const body = h('textarea', { rows: 10, class: 'code' }, JSON.stringify(templates.dev_player, null, 2));
  const out = h('div');
  const hist = h('div');
  const run = () =>
    act(async () => {
      const s = who === 'admin' ? app.admin : app.players.filter((p) => p.session)[Number(who)].session;
      const payload = body.value.trim() || '{}';
      JSON.parse(payload);
      const t0 = performance.now();
      try {
        const res = await s.rpc(name.value.trim(), payload);
        rpcHistory.unshift({ name: name.value, payload, ok: true, ms: Math.round(performance.now() - t0) });
        mount(out, badge('ok', 'ok'), ` ${Math.round(performance.now() - t0)} ms`, jsonView(res, true));
      } catch (e) {
        rpcHistory.unshift({ name: name.value, payload, ok: false, ms: Math.round(performance.now() - t0) });
        mount(out, badge('hata', 'bad'), ` ${e.message}`, jsonView(e.body || {}, true));
      }
      mount(hist, rpcHistory.slice(0, 20).map((r) => h('div', { class: 'hist', onclick: () => ((name.value = r.name), (body.value = r.payload)) }, badge(r.ok ? 'ok' : 'hata', r.ok ? 'ok' : 'bad'), ` ${r.name} `, h('code', null, r.payload.slice(0, 80)))));
    });
  mount(
    area,
    card(
      'RPC konsolu',
      h('datalist', { id: 'rpc-names' }, Object.keys(templates).map((k) => h('option', { value: k }))),
      row(field('Kim çağırsın', select(sessions, who, (v) => (who = v))), field('RPC', name), button('Şablon', () => (body.value = JSON.stringify(templates[name.value.trim()] || {}, null, 2))), button('Çağır', run, 'primary')),
      h('div', { class: 'chips' }, Object.keys(templates).map((k) => h('button', { class: 'chip', onclick: () => ((name.value = k), (body.value = JSON.stringify(templates[k], null, 2))) }, k))),
      body,
      out,
    ),
    card('Geçmiş', hist),
  );
}

// --- config ---

function renderConfig(area) {
  const info = app.info;
  const canvas = h('canvas', { class: 'bigmap' });
  const drawn = () => drawMap(canvas, info.map, 7);
  mount(
    area,
    card('Eşya tanımları', table(['defId', 'Kategori', 'Tier', 'Bant', 'Kaynak', 'Defter sayfası'], info.defs.map((d) => [h('code', null, d.id), d.category, d.tier || '—', (d.bands || ['hepsi']).join(', '), d.source, d.page || '—']))),
    card('Defter sayfaları', table(['Sayfa', 'Kayıtlar'], info.pages.map((p) => [p.id, p.items.join(', ')]))),
    card('Recipe\'ler', table(['Recipe', 'Kademe', 'Çıkan', 'Yığınlar', 'Eşyalar'], info.recipes.map((r) => [r.id, r.grade, `${r.output.defId} (${r.output.tier})`, r.stacks.map((s) => `${s.count}× ${s.defId}`).join(', '), r.items.map((s) => `${s.count}× ${s.defId}`).join(', ') || '—']))),
    card('Harita', h('p', { class: 'muted' }, `${info.map.width}×${info.map.height} tile. Açık yeşil yürünebilir, gri engel, mavi tonları kıyı / orta / derin su.`), canvas),
    card('Sunucu config (server/src/config.ts)', Object.keys(info.config).map((k) => h('div', null, h('h4', null, k), jsonView(info.config[k])))),
  );
  drawn();
}

export const MAP_COLORS = { '.': '#cfe3b4', '#': '#8d8d8d', s: '#9fd3f0', m: '#5aa7dd', d: '#2c6fb3' };

export function drawMap(canvas, map, px) {
  canvas.width = map.width * px;
  canvas.height = map.height * px;
  const g = canvas.getContext('2d');
  for (let y = 0; y < map.height; y++) {
    const r = map.rows[y];
    for (let x = 0; x < map.width; x++) {
      g.fillStyle = MAP_COLORS[r[x]] || '#f0f';
      g.fillRect(x * px, y * px, px, px);
    }
  }
  g.fillStyle = '#e67e22';
  g.beginPath();
  g.arc(map.spawn.x * px, map.spawn.y * px, px * 0.8, 0, Math.PI * 2);
  g.fill();
  return g;
}

// --- boot ---

document.body.append(h('header', null, nav, status), main);
render();
act(connect).then(render);

export { Session };
