// Simülasyon: drop table, reel mini game and craft quality, all computed by the server's own rules.
import { drawReel, replay } from './reel.js';
import { act, badge, button, card, field, h, input, mount, row, select, table, TIER_COLORS } from './ui.js';

export function renderSim(area, app) {
  const info = app.info;

  // --- catch table ---
  const n = input({ type: 'number', value: 20000, style: { width: '7em' } });
  let band = 'deep';
  let water = '';
  const level = input({ type: 'number', value: 1, min: 1, style: { width: '4em' } });
  const energy = input({ type: 'checkbox', checked: true });
  const luck = input({ type: 'number', value: 0, step: '0.01', style: { width: '5em' } });
  let luckFrom = '';
  const catchOut = h('div');
  const runCatch = () =>
    act(async () => {
      const payload = { n: Number(n.value), band, water, level: Number(level.value), hasEnergy: energy.checked, luck: Number(luck.value) };
      if (luckFrom) payload.userId = luckFrom;
      const r = await app.admin.rpc('dev_sim_catch', payload);
      const pct = (c) => ((c / r.n) * 100).toFixed(2) + '%';
      const tierOf = (id) => (info.defs.find((d) => d.id === id) || {}).tier;
      const bar = (c, color) => h('div', { class: 'bar' }, h('span', { style: { width: Math.max(1, (c / r.n) * 100 * 2) + 'px', background: color || '#5aa7dd' } }));
      mount(
        catchOut,
        row(badge(`${r.n} atış`), badge(`bant ${r.band}`), badge(`su ${r.water || 'isimsiz'}`), badge(`level ${r.level}`), badge(`şans +%${(r.luck * 100).toFixed(1)}`), r.empty ? badge(`${r.empty} boş`, 'bad') : null),
        h(
          'div',
          { class: 'grid2' },
          table(['Kategori', 'Adet', 'Oran', ''], Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]).map(([k, c]) => [k, c, pct(c), bar(c, TIER_COLORS[k])])),
          table(['Kondisyon (Tier\'lı avlar)', 'Adet', 'Oran'], Object.entries(r.byCondition).map(([k, c]) => [k, c, ((c / Object.values(r.byCondition).reduce((a, b) => a + b, 0)) * 100).toFixed(1) + '%'])),
        ),
        table(['Eşya', 'Adet', 'Oran', ''], Object.entries(r.byDef).sort((a, b) => b[1] - a[1]).map(([k, c]) => [h('code', null, k), c, pct(c), bar(c, TIER_COLORS[tierOf(k)])])),
      );
    });
  const users = [['', 'elle gir'], ...app.players.filter((p) => p.userId).map((p) => [p.userId, `${p.label} defterinin şansı`])];
  if (app.inspect) users.push([app.inspect, 'incelenen oyuncunun şansı']);
  const catchCard = card(
    'Av tablosu (sunucu rollCatch + rollFloat)',
    row(
      field('Atış', n),
      field('Bant', select(['shore', 'mid', 'deep'], band, (v) => (band = v))),
      field('Su', select([['', 'isimsiz'], ...(info.map.waters || []).map((w) => [w, w])], water, (v) => (water = v))),
      field('Level', level),
      field('Enerjili', energy),
      field('Şans (0.05 = %5)', luck),
      field('ya da', select(users, '', (v) => (luckFrom = v))),
      button('Çalıştır', runCatch, 'primary'),
    ),
    h('p', { class: 'muted' }, `Tablo (10000 = %100): ${Object.entries(info.config.CATCH_TABLE).map(([k, v]) => `${k} ${v}`).join(' · ')}`),
    catchOut,
  );

  // --- reel ---
  let tier = 'mythic';
  let reelBand = 'mid';
  const seed = input({ type: 'number', value: 42, style: { width: '9em' } });
  const lose = input({ type: 'checkbox' });
  const canvas = h('canvas', { width: 90, height: 300, class: 'reel' });
  const reelOut = h('div');
  let anim = 0;
  const runReel = () =>
    act(async () => {
      const r = await app.admin.rpc('dev_reel', { tier, band: reelBand, seed: Number(seed.value), lose: lose.checked });
      const local = replay(r.seed, r.params, r.inputs);
      const agree = local.result === (r.caught ? 'caught' : 'escaped') && local.steps === r.steps;
      mount(
        reelOut,
        row(badge(r.caught ? 'yakalandı' : 'kaçtı', r.caught ? 'ok' : 'bad'), badge(`${r.steps} adım = ${r.minMs} ms`), badge(`${r.inputs.length} girdi`), badge(agree ? 'tarayıcı modeli sunucuyla aynı' : 'TARAYICI MODELİ FARKLI', agree ? 'ok' : 'bad')),
        h('details', null, h('summary', null, 'params ve girdiler (REEL_DONE gövdesi)'), h('pre', null, JSON.stringify({ params: r.params, inputs: r.inputs }))),
      );
      cancelAnimationFrame(anim);
      let i = 0;
      const t0 = performance.now();
      const play = () => {
        i = Math.min(local.frames.length - 1, Math.floor((performance.now() - t0) / 20));
        drawReel(canvas, r.params, local.frames[i]);
        if (i < local.frames.length - 1) anim = requestAnimationFrame(play);
      };
      play();
    });
  const reelCard = card(
    'Çekme mini oyunu',
    row(field('Tier', select(['common', 'rare', 'epic', 'legendary', 'mythic'], tier, (v) => (tier = v))), field('Bant', select(['shore', 'mid', 'deep'], reelBand, (v) => (reelBand = v))), field('Seed', seed), button('Rastgele seed', () => (seed.value = Math.floor(Math.random() * 4294967296))), field('Kaybetmeye oyna', lose), button('Oynat', runReel, 'primary')),
    h('p', { class: 'muted' }, 'Sunucudaki çözücü oynar, tarayıcı aynı girdileri kendi modeliyle tekrar oynatıp çizer. Uyuşmazlık Unity portunda da aranacak bir hata işaretidir.'),
    row(canvas, reelOut),
  );

  // --- craft quality ---
  let recipeId = info.recipes[0] ? info.recipes[0].id : '';
  const avg = input({ type: 'number', step: '0.01', placeholder: 'Float\'lı girdi yok', style: { width: '9em' } });
  const craftOut = h('div');
  const runCraft = () =>
    act(async () => {
      const r = await app.admin.rpc('dev_craft_preview', { recipeId, average: avg.value === '' ? undefined : Number(avg.value) });
      const total = r.bands.reduce((a, b) => a + b.weight, 0);
      mount(
        craftOut,
        row(badge(`kademe ${r.grade}`), badge(`en kötü Float ${r.maxFloat}`), badge(`Pristine %${r.row.pristine}, Excellent %${r.row.excellent}`)),
        table(['Kondisyon', 'Aralık', 'Şans'], r.bands.map((b) => [b.condition, `${b.min} – ${b.max}`, ((b.weight / total) * 100).toFixed(1) + '%'])),
        r.recipe ? h('p', { class: 'muted' }, `Toz: ${r.craftDust[r.recipe.output.tier]} (${r.recipe.output.tier} çıktı). Birleştirme tozu: ${Object.entries(r.mergeDust).map(([k, v]) => `${k} ${v}`).join(', ')}`) : null,
      );
    });
  const craftCard = card(
    'Craft kalitesi',
    row(field('Recipe', select(info.recipes.map((r) => [r.id, `${r.id} (${r.grade})`]), recipeId, (v) => (recipeId = v))), field('Girdi Float ortalaması', avg), button('Hesapla', runCraft, 'primary')),
    craftOut,
  );

  mount(area, catchCard, h('div', { class: 'grid2' }, reelCard, craftCard));
  return () => cancelAnimationFrame(anim);
}
