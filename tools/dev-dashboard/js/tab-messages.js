// Mesajlar: send any match message by hand, push server messages to a player, read the log.
import { opName } from './player.js';
import { CLIENT_OPS, SERVER_OPS, clientTemplates, serverTemplates } from './templates.js';
import { act, badge, button, card, field, h, input, mount, row, select, toast } from './ui.js';

export function renderMessages(area, app) {
  const ops = app.opCodes;
  const online = () => app.players.filter((p) => p.online);

  // --- client → server ---
  let who = app.current && app.current.online ? app.players.indexOf(app.current) : app.players.findIndex((p) => p.online);
  let cop = 'MOVE';
  const cbody = h('textarea', { rows: 6, class: 'code' });
  const copNum = input({ type: 'number', placeholder: 'ya da op numarası', style: { width: '9em' } });
  const times = input({ type: 'number', value: 1, min: 1, max: 100, style: { width: '4em' } });
  const gap = input({ type: 'number', value: 0, min: 0, style: { width: '5em' } });
  const ctpl = h('div', { class: 'chips' });
  const ctx = () => {
    const p = app.players[who];
    return { me: p && p.me, seq: p && p.seq, itemIds: p && p.last.__items, otherId: app.players.find((x) => x !== p && x.userId)?.userId };
  };
  const fillClient = () => {
    const t = clientTemplates(ctx())[cop] || [];
    cbody.value = JSON.stringify(t[0] ? t[0][1] : {}, null, 2);
    mount(ctpl, t.map(([label, body]) => h('button', { class: 'chip', onclick: () => (cbody.value = JSON.stringify(body, null, 2)) }, label)));
  };
  const sendClient = () =>
    act(async () => {
      const p = app.players[who];
      if (!p || !p.online) throw new Error('Seçili oyuncu oyunda değil (Oyna sekmesinden sunucuya gir)');
      const op = copNum.value ? Number(copNum.value) : ops[cop];
      const n = Math.max(1, Number(times.value) || 1);
      // Keep MOVE seq growing so repeated sends are not ignored as old.
      for (let i = 0; i < n; i++) {
        let text = cbody.value;
        if (op === ops.MOVE) {
          try {
            const b = JSON.parse(text);
            if (typeof b.seq === 'number' && b.seq <= p.seq) b.seq = p.seq + 1;
            if (typeof b.seq === 'number') p.seq = b.seq;
            text = JSON.stringify(b);
          } catch (_e) {
            // send as typed
          }
        }
        p.send(op, text);
        if (Number(gap.value) > 0 && i < n - 1) await new Promise((r) => setTimeout(r, Number(gap.value)));
      }
    }, `${times.value}× gönderildi`);
  const clientCard = card(
    'İstemci → sunucu (oyuncu olarak gönder)',
    h('p', { class: 'muted' }, 'Gövde olduğu gibi gönderilir; bozuk JSON da gönderilebilir (sunucu yok saymalı). Hız sınırı denemek için tekrar sayısı ve aralık ver.'),
    row(
      field('Oyuncu', select(app.players.map((p, i) => [i, `${p.label}${p.online ? '' : ' (oyunda değil)'}`]), who, (v) => (who = Number(v)))),
      field('Mesaj', select(CLIENT_OPS.map((k) => [k, `${ops[k]} ${k}`]), cop, (v) => ((cop = v), fillClient()))),
      copNum,
      field('Tekrar', times),
      field('Aralık ms', gap),
      button('Gönder', sendClient, 'primary'),
    ),
    ctpl,
    cbody,
  );

  // --- server → client push ---
  const targets = () => {
    const out = app.players.filter((p) => p.userId).map((p) => [p.userId, `${p.label}${p.online ? '' : ' (oyunda değil)'}`]);
    if (app.inspect && !out.find((o) => o[0] === app.inspect)) out.push([app.inspect, `incelenen oyuncu (${app.inspect.slice(0, 8)})`]);
    return out;
  };
  let target = (app.current && app.current.userId) || (targets()[0] && targets()[0][0]) || '';
  let sop = 'FISH_END';
  const sbody = h('textarea', { rows: 8, class: 'code' });
  const stpl = h('div', { class: 'chips' });
  const fillServer = () => {
    const t = serverTemplates({ targetId: target, otherId: app.players.find((p) => p.userId && p.userId !== target)?.userId })[sop] || [];
    sbody.value = JSON.stringify(t[0] ? t[0][1] : {}, null, 2);
    mount(stpl, t.map(([label, body]) => h('button', { class: 'chip', onclick: () => (sbody.value = JSON.stringify(body, null, 2)) }, label)));
  };
  const push = (all) =>
    act(async () => {
      const body = JSON.parse(sbody.value);
      await app.admin.rpc('dev_live', all ? { action: 'push_all', op: ops[sop], body } : { userId: target, action: 'push', op: ops[sop], body });
    }, all ? 'Herkese gönderildi' : 'Gönderildi');
  const serverCard = card(
    'Sunucu → istemci (olay tetikle)',
    h('p', { class: 'muted' }, 'Sunucu, seçilen oyuncuya bu mesajı gerçekten gelmiş gibi yollar. Depoda hiçbir şey değişmez; Unity client\'ın keşif kutlaması, sayfa tamamlama, hata metinleri gibi ekranlarını denemek içindir.'),
    row(
      field('Oyuncu', select(targets(), target, (v) => ((target = v), fillServer()))),
      field('Mesaj', select(SERVER_OPS.map((k) => [k, `${ops[k]} ${k}`]), sop, (v) => ((sop = v), fillServer()))),
      button('Bu oyuncuya gönder', () => push(false), 'primary'),
      button('Tüm sunuculardaki herkese', () => confirm('Tüm oyunculara gönderilsin mi?') && push(true), 'danger'),
    ),
    stpl,
    sbody,
  );

  // --- log ---
  const filter = { player: '', op: '', dir: '', text: '' };
  let paused = false;
  const logBox = h('div', { class: 'log-table' });
  const renderLog = () => {
    if (paused) return;
    const rows = [];
    for (let i = app.log.length - 1; i >= 0 && rows.length < 400; i--) {
      const e = app.log[i];
      if (filter.player && e.player !== filter.player) continue;
      if (filter.dir && e.dir !== filter.dir) continue;
      if (filter.op && e.name !== filter.op) continue;
      const s = e.body !== undefined ? JSON.stringify(e.body) : '';
      if (filter.text && !(e.name + s).toLowerCase().includes(filter.text.toLowerCase())) continue;
      rows.push(
        h(
          'div',
          { class: `log ${e.dir}`, onclick: () => navigator.clipboard && navigator.clipboard.writeText(s).then(() => toast('Gövde kopyalandı')) },
          h('span', { class: 'muted' }, new Date(e.t).toLocaleTimeString() + '.' + String(e.t % 1000).padStart(3, '0')),
          ' ',
          badge(e.player || '?', 'muted'),
          ` ${e.dir === 'out' ? '→' : e.dir === 'in' ? '←' : '•'} `,
          h('b', null, e.name),
          ' ',
          h('code', null, s.slice(0, 600)),
        ),
      );
    }
    mount(logBox, rows.length ? rows : h('p', { class: 'muted' }, 'Kayıt yok. Oyna sekmesinden bir oyuncuyu sunucuya sok.'));
  };
  const names = [...new Set(Object.keys(ops))];
  const logCard = card(
    'Mesaj kaydı (tüm test oyuncuları)',
    row(
      field('Oyuncu', select([['', 'hepsi'], ...app.players.map((p) => [p.label, p.label])], '', (v) => ((filter.player = v), renderLog()))),
      field('Yön', select([['', 'hepsi'], ['in', '← gelen'], ['out', '→ giden'], ['sys', '• sistem'], ['err', 'hata']], '', (v) => ((filter.dir = v), renderLog()))),
      field('Mesaj', select([['', 'hepsi'], ...names.map((n) => [n, n]), ['joinMatch', 'joinMatch']], '', (v) => ((filter.op = v), renderLog()))),
      field('Ara', input({ oninput: (e) => ((filter.text = e.target.value), renderLog()) })),
      field('MOVE kaydet', input({ type: 'checkbox', checked: app.logMoves, onchange: (e) => (app.logMoves = e.target.checked) })),
      field('SNAPSHOT kaydet', input({ type: 'checkbox', checked: app.logSnapshots, onchange: (e) => (app.logSnapshots = e.target.checked) })),
      field('Durdur', input({ type: 'checkbox', onchange: (e) => ((paused = e.target.checked), renderLog()) })),
      button('Temizle', () => ((app.log.length = 0), renderLog())),
    ),
    h('p', { class: 'muted' }, 'Satıra tıklayınca gövde panoya kopyalanır.'),
    logBox,
  );

  mount(area, h('div', { class: 'grid2' }, clientCard, serverCard), logCard);
  fillClient();
  fillServer();
  renderLog();

  let pending = false;
  const onLog = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      renderLog();
    }, 300);
  };
  app.logListeners.add(onLog);
  // Item ids for the SELL / MERGE templates.
  for (const p of online()) p.session.rpc('get_inventory').then((inv) => (p.last.__items = inv.items.map((i) => i.instanceId))).catch(() => {});
  return () => app.logListeners.delete(onLog);
}

export { opName };
