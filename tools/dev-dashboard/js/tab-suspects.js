// Şüpheliler: bot and multi-account flags (server/src/rules/watch.ts, dev_suspects).
// Flags only. Nobody is banned automatically; a person looks here and decides.
import { act, badge, button, card, field, h, input, jsonView, mount, row, select, store, table } from './ui.js';

export const FLAG_LABELS = {
  hook_regular: ['Vuruş çok düzenli', 'Isırmadan vuruşa geçen süre neredeyse hep aynı.'],
  hook_fast: ['Vuruş çok hızlı', 'Ortalama tepki insan sınırının altında.'],
  reel_perfect: ['Çekme kusursuz', 'Balık neredeyse hiç çubuğun dışına çıkmıyor ve hiç kaçmıyor.'],
  nonstop: ['7/24 oynuyor', 'Çok uzun aralıksız oturum ya da haftanın neredeyse her saati aktif.'],
  silent: ['Hiç konuşmuyor', 'Çok atış, hiç chat. Tek başına zayıf sinyal.'],
  same_spot: ['Hep aynı yer', 'Atışların çoğu aynı tile\'dan. Tek başına zayıf sinyal.'],
  one_way_flow: ['Tek yönlü akış', 'Eşya / Coin hep aynı hesaba gidiyor, karşılığı gelmiyor (takas kayıtları, Faz 5).'],
  ip_accounts: ['Aynı IP\'den çok hesap', 'Son 24 saatte bir IP\'den sınırın üstünde hesap açıldı. Mobil ağlarda (CGNAT) zayıf sinyal.'],
  ip_online: ['Aynı IP\'den çok oturum', 'Şu an bir IP\'den sınırın üstünde oyuncu oyunda. Zayıf sinyal.'],
};

const flagBadge = (f) => h('span', { class: 'badge bad', title: f.detail }, (FLAG_LABELS[f.kind] || [f.kind])[0]);

export function renderSuspects(area, app) {
  const view = store('suspects') || { onlyFlagged: true, kind: '' };
  const save = () => store('suspects', view);
  const out = h('div');
  const ipOut = h('div');
  const tools = h('div');
  const legend = h('div', { class: 'grid2' });
  let data = null;
  let open = null;

  const load = () =>
    act(async () => {
      data = await app.admin.rpc('dev_suspects', { limit: 1000 });
      draw();
    });

  function draw() {
    if (!data) return;
    const flagged = data.users.filter((u) => u.flags.length > 0);
    let users = view.onlyFlagged ? flagged : data.users;
    if (view.kind) users = users.filter((u) => u.flags.some((f) => f.kind === view.kind));
    const counts = {};
    for (const u of data.users) for (const f of u.flags) counts[f.kind] = (counts[f.kind] || 0) + 1;
    const onlyBox = input({ type: 'checkbox', checked: view.onlyFlagged, onchange: (e) => ((view.onlyFlagged = e.target.checked), save(), draw()) });
    const rows = [];
    for (const u of users) {
      const n = u.numbers;
      rows.push({
        attrs: { class: 'clickable' + (open === u.userId ? ' open' : ''), onclick: () => ((open = open === u.userId ? null : u.userId), draw()) },
        cells: [
          h('b', null, u.username),
          u.score ? badge(String(u.score), u.score >= 3 ? 'bad' : '') : badge('0', 'muted'),
          u.flags.length ? h('div', { class: 'chips tight' }, u.flags.map(flagBadge)) : h('span', { class: 'muted' }, '—'),
          n.casts,
          n.chats,
          n.hookN ? `${n.hookMean} ± ${n.hookStd} ms (${n.hookN})` : '—',
          n.reelN ? `‰${n.reelFit}, ${n.reelsLost}/${n.reels} kaçtı` : '—',
          `${n.streakHours} sa / ${n.activeHours} sa`,
          u.account ? h('code', null, u.account.lastIp || '?') : h('span', { class: 'muted' }, 'kayıt yok'),
          u.online ? badge(u.online, 'ok') : '',
          button('İncele', (e) => (e.stopPropagation(), app.inspectUser(u.userId)), 'small'),
        ],
      });
      if (open === u.userId) rows.push({ attrs: { class: 'expand' }, cells: [{ colspan: 11, content: detail(u) }] });
    }
    mount(
      out,
      row(
        badge(`${data.users.length} hesap`),
        badge(`${flagged.length} işaretli`, flagged.length ? 'bad' : 'ok'),
        field('Sadece işaretliler', onlyBox),
        button('Yenile', load, 'primary'),
      ),
      h(
        'div',
        { class: 'chips' },
        h('button', { class: 'chip' + (view.kind === '' ? ' active' : ''), onclick: () => ((view.kind = ''), save(), draw()) }, 'Hepsi'),
        Object.keys(FLAG_LABELS).map((k) =>
          h('button', { class: 'chip' + (view.kind === k ? ' active' : ''), title: FLAG_LABELS[k][1], onclick: () => ((view.kind = view.kind === k ? '' : k), save(), draw()) }, `${FLAG_LABELS[k][0]} (${counts[k] || 0})`),
        ),
      ),
      users.length
        ? table(['Oyuncu', 'Puan', 'İşaretler', 'Atış', 'Chat', 'Vuruş tepkisi', 'Çekme isabeti', 'Aralıksız / hafta', 'Son IP', 'Oyunda', ''], rows)
        : h('p', { class: 'muted' }, view.onlyFlagged ? 'İşaretli hesap yok.' : 'Hesap yok.'),
    );
    mount(
      ipOut,
      data.ipGroups.length
        ? table(
            ['IP', 'Son 24 saatte açılan hesap', 'Şu an oyunda', 'Hesaplar'],
            data.ipGroups.map((g) => [
              h('code', null, g.ip),
              badge(String(g.createdToday.length), g.createdToday.length > data.config.ip.maxAccountsPerDay ? 'bad' : ''),
              badge(String(g.online.length), g.online.length > data.config.ip.maxOnline ? 'bad' : ''),
              h('span', null, [...new Set([...g.createdToday, ...g.online])].map((id) => data.names[id] || id.slice(0, 8)).join(', ')),
            ]),
          )
        : h('p', { class: 'muted' }, 'Birden fazla hesabın paylaştığı IP yok.'),
      h('p', { class: 'muted' }, `Sınır: günde ${data.config.ip.maxAccountsPerDay} yeni hesap, aynı anda ${data.config.ip.maxOnline} oturum (Öneri). Mobil ağlarda (CGNAT) çok kişi aynı IP'yi paylaşır; IP tek başına karar sebebi değildir.`),
    );
    const w = data.config;
    mount(
      legend,
      card('İşaretler ne demek', table(['İşaret', 'Anlamı', 'Ağırlık'], Object.keys(FLAG_LABELS).map((k) => [FLAG_LABELS[k][0], FLAG_LABELS[k][1], w.weights[k]]))),
      card('Eşikler (server/src/config.ts WATCH, Öneri)', jsonView(w, true)),
    );
    drawTools();
  }

  function detail(u) {
    const n = u.numbers;
    const partners = (map) =>
      Object.keys(map).length
        ? table(['Hesap', 'Takas', 'Değer'], Object.entries(map).sort((a, b) => b[1].value - a[1].value).map(([id, p]) => [data.names[id] || h('code', null, id), p.n, p.value]))
        : h('span', { class: 'muted' }, 'yok');
    return h(
      'div',
      { class: 'suspect' },
      u.flags.length ? h('ul', null, u.flags.map((f) => h('li', null, h('b', null, (FLAG_LABELS[f.kind] || [f.kind])[0]), ': ', f.detail))) : h('p', { class: 'muted' }, 'İşaret yok.'),
      h(
        'div',
        { class: 'grid2' },
        h('div', null, h('h4', null, 'Vuruş tepkileri (ms, son ' + n.hookMs.length + ')'), hookChart(n.hookMs)),
        h('div', null, h('h4', null, `Son ${data.config.hourBuckets} saatte atışlar (saat başına)`), hoursStrip(n.hours, data.now, data.config.hourBuckets)),
      ),
      row(
        badge(n.topSpot ? `en sık yer ${n.topSpot.tile}: %${Math.round(n.topSpot.share * 100)}` : 'yer kaydı yok', 'muted'),
        u.account ? badge(`hesap IP ${u.account.createdIp || '?'} · son IP ${u.account.lastIp || '?'}`, 'muted') : null,
        badge(`oluşturma ${u.createTime}`, 'muted'),
      ),
      h('div', { class: 'grid2' }, h('div', null, h('h4', null, 'Verdiği'), partners(n.given)), h('div', null, h('h4', null, 'Aldığı'), partners(n.received))),
    );
  }

  function drawTools() {
    const opts = data.users.map((u) => [u.userId, u.username]);
    let a = app.inspect && opts.find((o) => o[0] === app.inspect) ? app.inspect : opts[0] && opts[0][0];
    let b = opts.find((o) => o[0] !== a) ? opts.find((o) => o[0] !== a)[0] : '';
    const value = input({ type: 'number', value: 500, style: { width: '7em' } });
    const times = input({ type: 'number', value: 4, style: { width: '4em' } });
    const ip = input({ value: '203.0.113.7', style: { width: '10em' } });
    const call = (payload, ok) => act(() => app.admin.rpc('dev_watch', payload), ok).then((r) => r && load());
    mount(
      tools,
      h('p', { class: 'muted' }, 'Takas Faz 5\'te gelecek; o zamana kadar tek yönlü akışı sahte takasla dene. Bot sinyallerini görmek için Oyna sekmesinde otomatik vuruş + otomatik çekme ile bir test oyuncusunu 30+ kez tutturmak yeter (dashboard hep 120 ms\'de vurur, çözücü kusursuz çeker).'),
      row(
        field('Oyuncu', select(opts, a, (v) => (a = v))),
        field('Kime', select(opts, b, (v) => (b = v))),
        field('Değer', value),
        field('Kaç kez', times),
        button('Sahte takas', () => call({ userId: a, action: 'transfer', to: b, value: Number(value.value), n: Number(times.value) }, 'Takas kaydı eklendi')),
      ),
      row(
        field('IP', ip),
        button('Bu IP\'den açılmış say', () => call({ userId: a, action: 'ip', ip: ip.value.trim() }, 'IP yazıldı')),
        button('Sinyallerini sıfırla', () => confirm('Bu oyuncunun bot sinyalleri silinsin mi?') && call({ userId: a, action: 'reset' }, 'Sıfırlandı'), 'danger'),
      ),
    );
  }

  mount(
    area,
    card(
      'Şüpheliler',
      h('p', { class: 'muted' }, 'Sunucu sadece işaretler; kimse otomatik banlanmaz. Puan = işaret ağırlıklarının toplamı (config WATCH.weights). Satıra tıkla: ayrıntılar. Canlı oyunda bu ekranın yerini Faz 6 admin paneli alacak; bu dashboard sadece DEV_TOOLS açık geliştirme sunucusunda çalışır.'),
      out,
    ),
    card('Aynı IP\'yi paylaşan hesaplar', ipOut),
    legend,
    card('Dene', tools),
  );
  load();
}

function hookChart(ms) {
  const c = h('canvas', { width: 360, height: 90, class: 'mini' });
  const g = c.getContext('2d');
  if (ms.length === 0) return h('span', { class: 'muted' }, 'kayıt yok');
  const max = Math.max(1000, ...ms);
  const bins = new Array(30).fill(0);
  for (const v of ms) bins[Math.min(29, Math.floor((v / max) * 30))]++;
  const top = Math.max(...bins);
  g.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent') || '#2563eb';
  bins.forEach((b, i) => g.fillRect(i * 12, 80 - (b / top) * 76, 10, (b / top) * 76));
  g.fillStyle = '#888';
  g.font = '10px sans-serif';
  g.fillText('0', 0, 89);
  g.fillText(`${max} ms`, 320, 89);
  return c;
}

function hoursStrip(hours, now, buckets) {
  const c = h('canvas', { width: 24 * 14, height: 7 * 12 + 2, class: 'mini', title: 'Her satır 24 saat, en alttaki satır son 24 saat; koyu = çok atış' });
  const g = c.getContext('2d');
  const nowH = Math.floor(now / 3600000);
  const top = Math.max(1, ...Object.values(hours));
  for (let i = 0; i < buckets; i++) {
    const hr = nowH - (buckets - 1 - i);
    const v = hours[hr] || 0;
    const day = Math.floor(i / 24);
    const col = i % 24;
    g.fillStyle = v ? `rgba(220, 38, 38, ${0.25 + 0.75 * (v / top)})` : 'rgba(128,128,128,0.15)';
    g.fillRect(col * 14, day * 12, 12, 10);
  }
  return c;
}
