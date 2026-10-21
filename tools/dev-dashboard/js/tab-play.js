// Oyna: control test players in a live world match, like a stripped-down client.
import { MAP_COLORS } from './app.js';
import { OP } from './player.js';
import { ReelGame, STEP_MS, drawReel } from './reel.js';
import { act, badge, button, card, field, fmtFloat, h, input, mount, row, select, table, tierBadge, toast } from './ui.js';

const PX = 6;
const EMOTES = ['wave', 'clap', 'dance', 'sit', 'laugh', 'show_fish'];

export function renderPlay(area, app) {
  const top = h('div');
  const body = h('div');
  mount(area, top, body);
  let stop = [];

  const renderTop = () => {
    const name = input({ placeholder: 'kullanıcı adı (3-16)', style: { width: '12em' } });
    const dev = input({ placeholder: 'cihaz id (boşsa yeni)', style: { width: '14em' } });
    mount(
      top,
      card(
        'Test oyuncuları',
        h(
          'div',
          { class: 'chips' },
          app.players.map((p) =>
            h(
              'button',
              { class: `chip ${p === app.current ? 'active' : ''}`, onclick: () => ((app.current = p), renderAll()) },
              p.online ? '● ' : '○ ',
              p.label,
            ),
          ),
        ),
        row(
          field('Yeni oyuncu', name),
          dev,
          button(
            'Oluştur / giriş',
            () =>
              act(async () => {
                const username = name.value.trim() || `test_${Math.random().toString(36).slice(2, 7)}`;
                const deviceId = dev.value.trim() || `cg-dev-${username}-${Math.random().toString(36).slice(2, 10)}`;
                const p = app.addPlayer(deviceId, username);
                await p.login();
                renderAll();
                return p;
              }, (p) => `${p.label} ${p.session.created ? 'oluşturuldu' : 'giriş yaptı'}`),
            'primary',
          ),
          app.current ? button('Listeden çıkar', () => (app.removePlayer(app.current), renderAll()), 'danger') : null,
        ),
        h('p', { class: 'muted' }, 'Her test oyuncusu ayrı bir cihaz hesabıdır. Birden çok oyuncu açıp aynı sunucuya sokarak yakınlık, chat, arkadaş ve ışınlanmayı dene. Kullanıcı adı sadece hesap ilk açılırken geçerlidir.'),
      ),
    );
  };

  const renderAll = () => {
    for (const s of stop) s();
    stop = [];
    renderTop();
    const p = app.current;
    if (!p) return mount(body, h('p', { class: 'muted' }, 'Bir test oyuncusu oluştur.'));
    stop.push(playerView(body, app, p, renderAll));
  };
  renderAll();
  return () => stop.forEach((s) => s());
}

function playerView(root, app, p, renderAll) {
  const info = app.info;
  const servers = info.servers;
  let serverSel = servers[0] && servers[0].matchId;
  const status = h('div', { class: 'statusline' });
  const canvas = h('canvas', { class: 'map', title: 'tıkla: yürü · shift+tık: olta at · alt+tık: dev ışınla' });
  const fishPanel = h('div');
  const bagPanel = h('div');
  const resultPanel = h('div');
  const logPanel = h('div', { class: 'minilog' });
  const reelBox = h('div');

  const refreshServers = () =>
    act(async () => {
      const r = await (p.session || app.admin).rpc('list_servers');
      info.servers = r.servers;
      renderAll();
    });

  const joinCard = card(
    `${p.label}`,
    row(
      p.session ? badge(p.session.userId, 'muted') : badge('giriş yapılmadı', 'bad'),
      !p.session ? button('Giriş', () => act(() => p.login()).then(renderAll)) : null,
      p.session ? button('İncele', () => app.inspectUser(p.userId)) : null,
    ),
    row(
      field('Sunucu', select(servers.map((s) => [s.matchId, `${s.name} (${s.language}) ${s.players}/${s.capacity}`]), serverSel, (v) => (serverSel = v))),
      button('Listeyi yenile', refreshServers),
      button('Gir', () => act(() => p.join(serverSel), 'Sunucuya girildi').then(renderAll), 'primary'),
      button('Yanlış sürümle gir', () => act(() => p.join(serverSel, { protocolVersion: '99' }))),
      p.matchId ? button('Çık', () => act(() => p.leave()).then(renderAll)) : null,
      p.socket ? button('Bağlantıyı kopar', () => (p.disconnect(), renderAll()), 'danger') : null,
    ),
    status,
  );

  // --- fishing ---
  const defSel = select(info.defs.filter((d) => d.source === 'lake').map((d) => [d.id, `${d.id} (${d.tier || d.category})`]), 'lake.item.blue_crystal');
  const autoBox = (key, label) => field(label, input({ type: 'checkbox', checked: p.auto[key], onchange: (e) => (p.auto[key] = e.target.checked) }));
  const dev = (action, extra = {}) => act(() => app.admin.rpc('dev_live', { userId: p.userId, action, ...extra }));
  mount(
    fishPanel,
    card(
      'Balık tutma',
      row(
        field('Bant', select(['shore', 'mid', 'deep'], p.auto.band, (v) => (p.auto.band = v))),
        button('Balığa git ve at', () => act(() => p.goFish()), 'primary'),
        button('Aynı yere at', () => act(() => (p.castTarget ? p.cast(p.castTarget.x, p.castTarget.y) : p.goFish()))),
        button('Çek (HOOK)', () => act(() => p.send(OP.HOOK, {}))),
        button('Topla (CANCEL)', () => act(() => p.send(OP.CANCEL, {}))),
      ),
      row(
        autoBox('hook', 'Vuruşta otomatik çek'),
        field('Çekme', select([['win', 'otomatik kazan'], ['lose', 'otomatik kaybet'], ['manual', 'elle oyna (boşluk)']], p.auto.reel, (v) => (p.auto.reel = v))),
        autoBox('skipWait', 'Beklemeyi atla (dev)'),
        autoBox('loop', 'Sürekli tut'),
      ),
      h('h4', null, 'Dev olayları (sunucuda tetiklenir)'),
      row(
        button('Hemen vursun', () => dev('bite_now')),
        button('Sahte kıpırdama', () => dev('twitch')),
        field('Bu av gelsin', defSel),
        button('Vur', () => dev('force', { defId: defSel.value })),
        button('Bitir (cancelled)', () => dev('cancel')),
      ),
      h('p', { class: 'muted' }, '"Bu av gelsin" şamandıra sudayken çalışır; vuruş penceresini 30 sn yapar, elle çekmeye yetsin diye. Enerji 0 iken normal atış sadece çöp verir.'),
    ),
  );

  // --- social ---
  const say = input({ placeholder: 'mesaj (Enter)', style: { width: '20em' }, onkeydown: (e) => e.key === 'Enter' && act(() => (p.send(OP.SAY, { text: say.value }), (say.value = ''))) });
  const friendsBox = h('div');
  const loadFriends = () =>
    act(async () => {
      const r = await p.session.rpc('friends_status');
      mount(
        friendsBox,
        r.friends.length
          ? table(
              ['Arkadaş', 'Durum', ''],
              r.friends.map((f) => [
                f.username,
                f.online ? `${f.serverName} (${f.x.toFixed(1)}, ${f.y.toFixed(1)})` : 'çevrimdışı',
                f.online
                  ? f.matchId === p.matchId
                    ? button('Yanına git', () => act(() => p.send(OP.GOTO_FRIEND, { userId: f.userId })))
                    : button('O sunucuya, yanına', () => act(() => p.join(f.matchId, { protocolVersion: '1', characterId: 'default', near: f.userId })).then(renderAll))
                  : null,
              ]),
            )
          : h('p', { class: 'muted' }, 'Karşılıklı arkadaş yok. Oyuncular sekmesinden ekle.'),
      );
    });
  const others = app.players.filter((x) => x !== p && x.session);
  const social = card(
    'Sosyal',
    row(say, button('Gönder', () => act(() => (p.send(OP.SAY, { text: say.value }), (say.value = ''))))),
    h('div', { class: 'chips' }, EMOTES.map((e) => button(e, () => act(() => p.send(OP.EMOTE, { emote: e })), 'chip'))),
    row(
      button('Arkadaş durumu', loadFriends),
      others.length ? button(`Tüm test oyuncularıyla arkadaş yap`, () => act(async () => {
        for (const o of others) await app.admin.rpc('dev_friends', { a: p.userId, b: o.userId, action: 'befriend' });
        loadFriends();
      }, 'Arkadaş yapıldı')) : null,
    ),
    friendsBox,
  );

  // --- bag, through the game's own messages ---
  const loadBag = () =>
    act(async () => {
      if (!p.session) return;
      const inv = await p.session.rpc('get_inventory');
      mount(bagPanel, bagCard(app, p, inv, loadBag));
    });

  // --- results ---
  const RESULT_OPS = ['FISH_END', 'ECONOMY_RESULT', 'CRAFT_RESULT', 'BOOK_RESULT', 'TELEPORT', 'CORRECTION', 'REEL_START', 'BOBBER', 'EMOTE_SHOW'];
  const renderResults = () =>
    mount(
      resultPanel,
      card('Son sunucu cevapları', RESULT_OPS.filter((k) => p.last[k]).map((k) => h('div', { class: 'res' }, h('b', null, k), h('code', null, JSON.stringify(p.last[k]))))),
    );

  const renderLog = () =>
    mount(
      logPanel,
      p.log
        .slice(-60)
        .reverse()
        .map((e) => h('div', { class: `log ${e.dir}` }, h('span', { class: 'muted' }, new Date(e.t).toLocaleTimeString()), ` ${e.dir === 'out' ? '→' : e.dir === 'in' ? '←' : '•'} ${e.name} `, e.body !== undefined ? h('code', null, JSON.stringify(e.body).slice(0, 300)) : null)),
    );

  mount(
    root,
    joinCard,
    h('div', { class: 'playgrid' }, h('div', null, card('Harita', h('p', { class: 'muted' }, 'Tıkla: yürü · Shift+tık: suya olta at · Alt+tık: dev ışınlama'), canvas), reelBox), h('div', null, fishPanel, social)),
    h('div', { class: 'grid2' }, bagPanel, resultPanel),
    card('Bu oyuncunun mesajları', logPanel),
  );

  canvas.width = info.map.width * PX;
  canvas.height = info.map.height * PX;
  const base = document.createElement('canvas');
  base.width = canvas.width;
  base.height = canvas.height;
  const bg = base.getContext('2d');
  for (let y = 0; y < info.map.height; y++) {
    for (let x = 0; x < info.map.width; x++) {
      bg.fillStyle = MAP_COLORS[info.map.rows[y][x]];
      bg.fillRect(x * PX, y * PX, PX, PX);
    }
  }

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * info.map.width;
    const y = ((e.clientY - r.top) / r.height) * info.map.height;
    const tx = Math.round(x * 100) / 100;
    const ty = Math.round(y * 100) / 100;
    if (e.shiftKey) act(() => p.cast(tx, ty));
    else if (e.altKey) act(() => app.admin.rpc('dev_live', { userId: p.userId, action: 'teleport', x: tx, y: ty }));
    else act(() => p.walkTo(tx, ty));
  });

  // Hand play of the reel: hold Space or the mouse on the bar.
  p.onReelStart = (_pl, msg) => {
    const c = h('canvas', { width: 90, height: 300, class: 'reel' });
    let pressed = false;
    const game = new ReelGame(msg.seed, msg.params);
    const inputs = [];
    let last = false;
    const start = performance.now();
    const down = (e) => {
      if (e.code === 'Space') {
        pressed = true;
        e.preventDefault();
      }
    };
    const up = (e) => {
      if (e.code === 'Space') pressed = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    c.addEventListener('mousedown', () => (pressed = true));
    c.addEventListener('mouseup', () => (pressed = false));
    const label = h('div', null, 'Boşluk tuşunu basılı tut: çubuk yükselir.');
    mount(reelBox, card('Çekme (elle)', row(c, label)));
    const tick = () => {
      const due = Math.floor((performance.now() - start) / STEP_MS);
      while (game.k < due && !game.result) {
        if (pressed !== last) {
          inputs.push((game.k + 1) * STEP_MS);
          last = pressed;
        }
        game.step(pressed);
      }
      drawReel(c, msg.params, { bar: game.bar, fish: game.fish, progress: game.progress, pressed });
      if (game.result) {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
        mount(label, `Yerel sonuç: ${game.result} (${game.k} adım). Sunucuya gönderildi; kararı sunucu verir.`);
        act(() => p.send(OP.REEL_DONE, { inputs }));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  let raf = 0;
  const draw = () => {
    const g = canvas.getContext('2d');
    g.drawImage(base, 0, 0);
    const dot = (x, y, color, r = PX * 0.9) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(x * PX, y * PX, r, 0, Math.PI * 2);
      g.fill();
    };
    if (p.me) {
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.arc(p.me.x * PX, p.me.y * PX, info.config.WORLD.viewRadius * PX, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = 'rgba(230,126,34,0.35)';
      g.beginPath();
      g.arc(p.me.x * PX, p.me.y * PX, info.config.FISHING.maxCast * PX, 0, Math.PI * 2);
      g.stroke();
    }
    if (p.path.length && p.me) {
      g.strokeStyle = '#e67e22';
      g.beginPath();
      g.moveTo(p.me.x * PX, p.me.y * PX);
      for (const [x, y] of p.path) g.lineTo(x * PX, y * PX);
      g.stroke();
    }
    for (const [id, b] of p.bobbers) {
      const owner = id === p.userId ? p.me : p.others.get(id);
      if (owner) {
        g.strokeStyle = '#555';
        g.beginPath();
        g.moveTo(owner.x * PX, owner.y * PX);
        g.lineTo(b.x * PX, b.y * PX);
        g.stroke();
      }
      dot(b.x, b.y, b.state === 'bite' ? '#ff4757' : b.state === 'twitch' ? '#ffa502' : '#fff', PX * 0.7);
    }
    g.font = '11px sans-serif';
    for (const o of p.others.values()) {
      if (o.x === undefined) continue;
      dot(o.x, o.y, '#8e44ad');
      g.fillStyle = '#222';
      g.fillText(o.name || o.id.slice(0, 6), o.x * PX + 6, o.y * PX - 4);
    }
    if (p.me) {
      dot(p.me.x, p.me.y, '#e74c3c', PX * 1.1);
      g.fillStyle = '#000';
      g.fillText(p.label, p.me.x * PX + 7, p.me.y * PX - 5);
    }
    const now = Date.now();
    for (const b of p.bubbles) {
      if (now - b.at > 5000) continue;
      const who = b.id === p.userId ? p.me : p.others.get(b.id);
      if (!who) continue;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      const w = g.measureText(b.text).width + 8;
      g.fillRect(who.x * PX - w / 2, who.y * PX - 28, w, 16);
      g.fillStyle = '#000';
      g.fillText(b.text, who.x * PX - w / 2 + 4, who.y * PX - 16);
    }
    for (const e of p.emotes) {
      if (now - e.at > 2500) continue;
      const who = e.id === p.userId ? p.me : p.others.get(e.id);
      if (!who) continue;
      g.fillStyle = '#c0392b';
      g.fillText(`*${e.emote}${e.defId ? ' ' + e.defId : ''}*`, who.x * PX - 20, who.y * PX + 18);
    }
    const f = p.fishing;
    mount(
      status,
      p.online ? badge(`${p.serverName || '?'}`, 'ok') : badge('oyunda değil', 'muted'),
      p.me ? badge(`konum ${p.me.x.toFixed(2)}, ${p.me.y.toFixed(2)} ${p.me.dir}`) : null,
      p.energy !== null ? badge(`enerji ${p.energy}/${p.energyMax}`) : null,
      badge(`görünen ${p.others.size} oyuncu`, 'muted'),
      f ? badge(`balık: ${f.state} ${f.band || ''}`, f.state === 'bite' ? 'bad' : 'ok') : null,
      p.auto.loop ? badge('sürekli tutuyor', 'ok') : null,
    );
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  let pending = false;
  const onChange = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      renderResults();
      renderLog();
    }, 250);
  };
  const onLog = (e) => {
    if (e.player !== p.label || e.dir !== 'in') return;
    if (['ECONOMY_RESULT', 'CRAFT_RESULT', 'BOOK_RESULT'].includes(e.name) || (e.name === 'FISH_END' && e.body.id === p.userId && e.body.outcome === 'caught')) loadBag();
  };
  p.listeners.add(onChange);
  app.logListeners.add(onLog);
  renderResults();
  renderLog();
  if (p.session) loadBag();
  return () => {
    cancelAnimationFrame(raf);
    p.listeners.delete(onChange);
    app.logListeners.delete(onLog);
    p.onReelStart = null;
  };
}

function bagCard(app, p, inv, reload) {
  const picked = new Set();
  const stackCounts = {};
  const send = (op, body) => act(() => p.send(op, body));
  const recipeSel = select(app.info.recipes.map((r) => [r.id, `${r.id} → ${r.output.defId}`]), app.info.recipes[0]?.id);
  const stacksBody = () => Object.keys(stackCounts).filter((k) => stackCounts[k] > 0).map((defId) => ({ defId, count: stackCounts[defId] }));
  const sc = input({ value: '', placeholder: 'showcase defId, virgülle', style: { width: '16em' } });
  return card(
    `Çanta (oyunun kendi mesajlarıyla): ${inv.slotsUsed}/${inv.slotsMax} · ${inv.coin} Coin · ${inv.dust} toz · enerji ${inv.energy}`,
    row(button('Yenile', reload)),
    inv.items.length
      ? table(
          ['', 'Eşya', 'Tier', 'Float'],
          inv.items
            .slice()
            .sort((a, b) => a.defId.localeCompare(b.defId) || a.float - b.float)
            .map((it) => [input({ type: 'checkbox', onchange: (e) => (e.target.checked ? picked.add(it.instanceId) : picked.delete(it.instanceId)) }), h('code', null, it.defId), tierBadge(it.tier), fmtFloat(it.float)]),
        )
      : h('p', { class: 'muted' }, 'Float\'lı eşya yok.'),
    inv.stacks.length
      ? table(['Yığın', 'Adet', 'Kaç tane'], inv.stacks.map((s) => [h('code', null, s.defId), s.count, input({ type: 'number', min: 0, max: s.count, value: 0, style: { width: '5em' }, onchange: (e) => (stackCounts[s.defId] = Number(e.target.value)) })]))
      : null,
    row(
      button('Sat (SELL)', () => send(OP.SELL, { items: [...picked], stacks: stacksBody() })),
      button('Parçala (SALVAGE)', () => send(OP.SALVAGE, { items: [...picked], stacks: stacksBody() })),
      button('Birleştir (MERGE, 3 seçili)', () => send(OP.MERGE, { items: [...picked] })),
      button('Deftere koy (BOOK_PLACE, 1 seçili)', () => (picked.size === 1 ? send(OP.BOOK_PLACE, { instanceId: [...picked][0] }) : toast('Bir eşya seç'))),
    ),
    row(field('Recipe', recipeSel), button('Craft (seçili eşyalarla)', () => send(OP.CRAFT, { recipeId: recipeSel.value, items: [...picked] }))),
    row(
      sc,
      button('set_profile showcase', () => act(() => p.session.rpc('set_profile', { showcase: sc.value.split(',').map((x) => x.trim()).filter(Boolean) }), 'Profil kaydedildi')),
      button('Arıyorum: temizle', () => act(() => p.session.rpc('set_profile', { hunting: null }), 'Temizlendi')),
    ),
  );
}
