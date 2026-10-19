// Oyuncular: list every account, open one and see or change all of its state.
import { act, badge, button, card, clear, field, fmtFloat, fmtTime, h, input, jsonView, mount, row, select, table, tierBadge, toast } from './ui.js';

const FRIEND_STATE = { 0: 'karşılıklı', 1: 'istek gönderdi', 2: 'istek aldı', 3: 'engelledi' };

export function renderPlayers(area, app) {
  const list = h('div', { class: 'userlist' });
  const detail = h('div', { class: 'detail' });
  const q = input({ placeholder: 'kullanıcı adı ara', oninput: () => loadUsers() });
  let users = [];

  const loadUsers = () =>
    act(async () => {
      const r = await app.admin.rpc('dev_users', { query: q.value, limit: 100 });
      users = r.users;
      mount(
        list,
        users.map((u) =>
          h(
            'div',
            { class: `user ${u.userId === app.inspect ? 'active' : ''}`, onclick: () => ((app.inspect = u.userId), loadUsers(), loadDetail()) },
            h('b', null, u.username),
            u.online ? badge(u.online.serverName, 'ok') : null,
            h('small', { class: 'muted' }, new Date(u.createTime.replace(' +0000 UTC', 'Z').replace(' ', 'T')).toLocaleString()),
          ),
        ),
      );
    });

  const loadDetail = () => {
    if (!app.inspect) return mount(detail, h('p', { class: 'muted' }, 'Soldan bir oyuncu seç.'));
    return act(async () => {
      const d = await app.admin.rpc('dev_player', { userId: app.inspect });
      mount(detail, inspector(app, d, loadDetail, users));
    });
  };

  mount(
    area,
    h(
      'div',
      { class: 'split' },
      h('aside', null, card('Hesaplar', row(q, button('↻', loadUsers)), list)),
      detail,
    ),
  );
  loadUsers();
  loadDetail();
}

function inspector(app, d, reload, users) {
  const userId = d.userId;
  const rpc = (name, payload, ok) => act(() => app.admin.rpc(name, { userId, ...payload }), ok).then((r) => (r !== undefined ? reload() : undefined));
  const info = app.info;
  const inv = d.inventory;

  // --- header ---
  const controlled = app.players.find((p) => p.userId === userId);
  const header = card(
    null,
    h('div', { class: 'phead' }, h('h2', null, d.account.username), h('code', { class: 'muted' }, userId)),
    row(
      d.live ? badge(`oyunda: ${d.live.serverName} (${d.live.x.toFixed(1)}, ${d.live.y.toFixed(1)})`, 'ok') : badge('oyunda değil', 'muted'),
      badge(`${d.account.devices.length} cihaz`, 'muted'),
      badge(`oluşturma ${fmtTime(Date.parse(d.account.createTime))}`, 'muted'),
      controlled ? badge('dashboard kontrol ediyor', 'ok') : null,
    ),
    row(
      button('Yenile', reload),
      d.account.devices[0] && !controlled
        ? button('Bu oyuncu olarak oyna', () => {
            const p = app.addPlayer(d.account.devices[0], d.account.username);
            act(() => p.login(), 'Giriş yapıldı').then(() => (app.tab = 'play') && app.render());
          })
        : null,
      d.live ? button('Maçtan at', () => rpc('dev_live', { action: 'kick' }, 'Atıldı')) : null,
      button('Sıfırla (yeni hesap gibi)', () => confirm(`${d.account.username}: çanta, defter, profil, enerji, konum ve cüzdan silinsin mi?`) && rpc('dev_reset', {}, 'Sıfırlandı'), 'danger'),
    ),
    d.account.devices[0] && !controlled ? h('p', { class: 'muted' }, 'Bu oyuncu olarak oynamak aynı hesabın Unity bağlantısını maçtan atar (aynı hesap yeniden bağlanma kuralı).') : null,
  );

  // --- scenarios ---
  const freeSlots = inv.slotsMax - inv.slotsUsed;
  const stacksOf = (cats) => info.defs.filter((x) => cats.includes(x.category) && x.source !== 'craft').map((x) => x.id);
  const scenarios = card(
    'Senaryolar',
    h('p', { class: 'muted' }, 'Tek tıkla test durumu hazırlar. Oyundaysa maçtaki çanta, defter ve enerji de anında güncellenir.'),
    h(
      'div',
      { class: 'chips' },
      button('Zengin: 100k Coin + 100k toz', () => rpc('dev_wallet', { set: { coin: 100000, dust: 100000 } }, 'Cüzdan dolu')),
      button('Tüm malzeme ve çöp 99', () => rpc('dev_stacks', { stacks: Object.fromEntries(stacksOf(['material', 'junk']).map((id) => [id, 99])) }, 'Yığınlar 99')),
      button('Her recipe 5', () => rpc('dev_stacks', { stacks: Object.fromEntries(stacksOf(['recipe']).map((id) => [id, 5])) }, 'Recipe\'ler eklendi')),
      button('Birleştirmeye hazır (3 turna + toz)', async () => {
        await act(() => app.admin.rpc('dev_give', { userId, defId: 'lake.fish.pike', count: 3, bag: true }));
        await rpc('dev_wallet', { add: { dust: 1000 } }, '3 turna + 1000 toz');
      }),
      button('Craft\'a hazır (her recipe)', async () => {
        await act(() => app.admin.rpc('dev_stacks', { userId, stacks: { 'lake.mat.scale': 20, 'lake.mat.moss': 20, 'recipe.scale_charm': 3, 'recipe.moss_wreath': 3, 'recipe.pike_trophy': 3 } }));
        await act(() => app.admin.rpc('dev_give', { userId, defId: 'craft.scale_charm', count: 1, bag: true, float: 0.03 }));
        await act(() => app.admin.rpc('dev_give', { userId, defId: 'lake.fish.pike', count: 1, bag: true, float: 0.04 }));
        await rpc('dev_wallet', { add: { dust: 5000 } }, 'Malzemeler, recipe\'ler, eşyalar ve toz hazır');
      }),
      button('Tüm defteri doldur', async () => {
        for (const p of info.pages) await act(() => app.admin.rpc('dev_book', { userId, action: 'fill_page', page: p.id }));
        reload();
        toast('Defter dolu', 'ok');
      }),
      button(`Çantayı doldur (${freeSlots} boş kutu)`, () => (freeSlots > 0 ? rpc('dev_give', { defId: 'lake.fish.carp', count: freeSlots, bag: true }, 'Çanta dolu') : toast('Çanta zaten dolu'))),
      button('Çantayı boşalt', () => rpc('dev_item_delete', { all: true }).then(() => rpc('dev_stacks', { clear: true }, 'Çanta boş'))),
      button('Enerji 0', () => rpc('dev_energy', { value: 0 }, 'Enerji 0')),
      button('Enerji dolu', () => rpc('dev_energy', { value: info.config.ENERGY.max }, 'Enerji dolu')),
    ),
  );

  // --- wallet and energy ---
  const coin = input({ type: 'number', value: inv.coin, style: { width: '8em' } });
  const dust = input({ type: 'number', value: inv.dust, style: { width: '8em' } });
  const energy = input({ type: 'number', value: inv.energy, step: '0.01', style: { width: '6em' } });
  const wallet = card(
    'Cüzdan ve enerji',
    row(
      field('Coin', coin),
      field('Toz', dust),
      button('Ayarla', () => rpc('dev_wallet', { set: { coin: Number(coin.value), dust: Number(dust.value) } }, 'Cüzdan güncellendi')),
      button('+1000 Coin', () => rpc('dev_wallet', { add: { coin: 1000 } })),
      button('+1000 toz', () => rpc('dev_wallet', { add: { dust: 1000 } })),
    ),
    row(field(`Enerji (en çok ${inv.energyMax})`, energy), button('Ayarla', () => rpc('dev_energy', { value: Number(energy.value) }, 'Enerji güncellendi'))),
    h('p', { class: 'muted' }, 'Kayıtlı enerji: ', h('code', null, JSON.stringify(d.energyDoc)), d.energyDoc && !d.energyDoc.online ? ' (çevrimdışı: dolum ' + new Date(d.energyDoc.at).toLocaleTimeString() + '\'den sayılıyor)' : ''),
    h('p', { class: 'muted' }, 'Kayıtlı konum: ', h('code', null, JSON.stringify(d.position))),
  );

  // --- give ---
  const defSel = select(
    info.defs.map((x) => [x.id, `${x.id} · ${x.tier || x.category}${x.page ? ' · ' + x.page : ''}`]),
    'lake.fish.pike',
  );
  const tierSel = select([['', 'tanımdaki Tier'], 'common', 'rare', 'epic', 'legendary', 'mythic'], '');
  const floatIn = input({ type: 'number', step: '0.0001', min: 0, max: 0.9999, placeholder: 'rastgele', style: { width: '7em' } });
  const countIn = input({ type: 'number', value: 1, min: 1, style: { width: '5em' } });
  const bagOnly = input({ type: 'checkbox' });
  const customId = input({ placeholder: 'ya da yeni defId (Tier gerekir)', style: { width: '16em' } });
  const give = card(
    'Eşya ver',
    row(field('Eşya', defSel), field('Tier', tierSel), field('Float', floatIn), field('Adet', countIn)),
    row(field('İlk kopya kuralını atla (doğrudan çantaya)', bagOnly), field('Özel', customId)),
    row(
      button(
        'Ver',
        () => {
          const payload = { defId: customId.value.trim() || defSel.value, count: Number(countIn.value) || 1, bag: bagOnly.checked };
          if (tierSel.value) payload.tier = tierSel.value;
          if (floatIn.value !== '') payload.float = Number(floatIn.value);
          rpc('dev_give', payload, (r) => `${r.given.length || r.stack?.count} verildi${r.book.length ? ', ' + r.book.filter((b) => b.kind === 'discovered').length + ' yeni keşif' : ''}`);
        },
        'primary',
      ),
      h('span', { class: 'muted' }, 'Float aralıkları: Pristine <0.05, Excellent <0.20, Normal <0.50, Worn <0.80, Damaged'),
    ),
  );

  // --- bag ---
  const bag = card(
    `Çanta: ${inv.slotsUsed}/${inv.slotsMax} kutu`,
    inv.items.length === 0 && inv.stacks.length === 0 ? h('p', { class: 'muted' }, 'Çanta boş.') : null,
    inv.items.length
      ? table(
          ['Eşya', 'Tier', 'Float', 'Kondisyon', 'Kaynak', 'NPC', 'Toz', 'Düzenle', ''],
          inv.items
            .slice()
            .sort((a, b) => a.defId.localeCompare(b.defId) || a.float - b.float)
            .map((it) => {
              const pr = d.prices[it.instanceId] || {};
              const f = input({ type: 'number', step: '0.0001', value: it.float, style: { width: '6.5em' } });
              const t = select(['common', 'rare', 'epic', 'legendary', 'mythic'], it.tier);
              return [
                h('code', { title: it.instanceId }, it.defId),
                tierBadge(it.tier),
                fmtFloat(it.float),
                pr.condition,
                it.source,
                pr.sell ?? '—',
                pr.dust ?? '—',
                row(f, t, button('Kaydet', () => rpc('dev_item_edit', { instanceId: it.instanceId, float: Number(f.value), tier: t.value }, 'Eşya güncellendi'))),
                button('Sil', () => rpc('dev_item_delete', { instanceIds: [it.instanceId] }), 'danger small'),
              ];
            }),
        )
      : null,
    inv.stacks.length
      ? table(
          ['Yığın', 'Adet', 'Kutu', 'NPC (adet)', 'Toz (adet)', ''],
          inv.stacks.map((s) => {
            const pr = d.stackPrices[s.defId] || {};
            const c = input({ type: 'number', value: s.count, min: 0, style: { width: '6em' } });
            return [h('code', null, s.defId), s.count, Math.ceil(s.count / info.config.BAG.stackSize), pr.sell ?? '—', pr.dust ?? '—', row(c, button('Ayarla', () => rpc('dev_stacks', { stacks: { [s.defId]: Number(c.value) } })), button('Sil', () => rpc('dev_stacks', { stacks: { [s.defId]: 0 } }), 'danger small'))];
          }),
        )
      : null,
  );

  // --- book ---
  const book = d.book;
  const bookCard = card(
    `Collection Book: şans +%${Math.round(book.luck * 100)}, Score ${book.score}`,
    row(
      button('Defteri sıfırla (yuvadakiler çantaya)', () => confirm('Tüm kayıtlar silinsin mi?') && rpc('dev_book', { action: 'reset' }, 'Defter sıfırlandı'), 'danger'),
      h('span', { class: 'muted' }, `${d.bookItems.length} eşya yuvada, toplam ${d.itemsTotal} kayıtlı eşya`),
    ),
    h(
      'div',
      { class: 'pages' },
      info.pages.map((page) => {
        const bp = book.pages.find((p) => p.id === page.id);
        return h(
          'div',
          { class: 'page' },
          h('h4', null, page.id, ' ', badge(`${bp.found}/${bp.total} bulundu`), badge(`${bp.filled} dolu`, bp.filled === bp.total ? 'ok' : 'muted')),
          button('Sayfayı doldur', () => rpc('dev_book', { action: 'fill_page', page: page.id }, 'Sayfa dolu'), 'small'),
          page.items.map((defId) => {
            const e = d.bookEntries[defId];
            const state = !e ? 'unknown' : e.slot ? 'filled' : 'found';
            const f = input({ type: 'number', step: '0.0001', placeholder: 'Float', style: { width: '6em' } });
            return h(
              'div',
              { class: `record ${state}` },
              h('div', null, h('code', null, defId), ' ', badge(state, state === 'filled' ? 'ok' : state === 'found' ? '' : 'muted')),
              e && e.slot ? h('div', { class: 'muted' }, tierBadge(e.slot.tier), ` Float ${fmtFloat(e.slot.float)}`) : null,
              e ? h('div', { class: 'muted' }, `bulundu ${fmtTime(e.foundAt)}`) : null,
              row(
                state === 'unknown' ? button('Bulundu yap', () => rpc('dev_book', { action: 'discover', defId }), 'small') : null,
                f,
                button('Yuvaya koy', () => rpc('dev_book', { action: 'fill', defId, float: f.value === '' ? undefined : Number(f.value) }), 'small'),
                state === 'filled' ? button('Yuvadan çıkar', () => rpc('dev_book', { action: 'unslot', defId }), 'small') : null,
                state !== 'unknown' ? button('Unut', () => rpc('dev_book', { action: 'forget', defId }), 'small danger') : null,
              ),
            );
          }),
        );
      }),
    ),
  );

  // --- profile ---
  const sc = input({ value: d.profileDoc.showcase.join(', '), style: { width: '28em' } });
  const hunt = input({ value: d.profileDoc.hunting || '', style: { width: '16em' } });
  const profile = card(
    'Profil kartı',
    row(badge(`Score ${d.profile.score}`), badge(`tamam sayfalar: ${d.profile.pagesComplete.join(', ') || '—'}`), badge(`Arıyorum: ${d.profile.hunting || '—'}`)),
    h('p', null, 'Kartta görünen showcase: ', d.profile.showcase.length ? d.profile.showcase.map((i) => h('span', { class: 'pill' }, tierBadge(i.tier), ` ${i.defId} ${fmtFloat(i.float)}`)) : '—'),
    row(field('Showcase (defId, virgülle; kontrolsüz yazar)', sc), field('Arıyorum', hunt), button('Kaydet', () => rpc('dev_profile', { showcase: sc.value.split(',').map((x) => x.trim()).filter(Boolean), hunting: hunt.value.trim() || null }, 'Profil yazıldı'))),
    h('p', { class: 'muted' }, 'Oyunun kendi kurallarıyla denemek için Oyna sekmesinden set_profile kullan (TOO_MANY, DUPLICATE, SLOT_EMPTY hataları).'),
  );

  // --- friends ---
  const other = select(users.filter((u) => u.userId !== userId).map((u) => [u.userId, u.username]), '');
  const fr = (action) => act(() => app.admin.rpc('dev_friends', { a: userId, b: other.value, action }), 'Tamam').then((r) => r && reload());
  const friends = card(
    'Arkadaşlar',
    d.friends.length
      ? table(['Oyuncu', 'Durum', 'Çevrimiçi', ''], d.friends.map((f) => [f.username, badge(FRIEND_STATE[f.state] || f.state, f.state === 0 ? 'ok' : 'muted'), f.online ? 'evet' : 'hayır', button('İncele', () => app.inspectUser(f.userId), 'small')]))
      : h('p', { class: 'muted' }, 'Arkadaş yok.'),
    row(field('Diğer oyuncu', other), button('Karşılıklı arkadaş yap', () => fr('befriend')), button('Sadece istek gönder', () => fr('request')), button('Sil', () => fr('remove')), button('Engelle', () => fr('block'), 'danger')),
  );

  // --- ledger ---
  const ledger = card(
    'Cüzdan geçmişi (son 25)',
    d.ledger.length ? table(['Zaman', 'Değişim', 'Neden'], d.ledger.map((l) => [fmtTime(l.createTime * 1000 || Date.parse(l.createTime)), JSON.stringify(l.changeset), JSON.stringify(l.metadata)])) : h('p', { class: 'muted' }, 'Kayıt yok.'),
  );

  const live = d.live ? card('Maçtaki canlı durum', jsonView(d.live, true)) : null;
  const raw = card('Ham veri', jsonView(d));

  const wrap = h('div');
  mount(wrap, header, scenarios, h('div', { class: 'grid2' }, wallet, give), bag, bookCard, h('div', { class: 'grid2' }, profile, friends), live, ledger, raw);
  return wrap;
}

export { clear };
