// Ready-made message bodies for the message console (docs/protokol.md).
// `ctx` gives ids from the current state so templates are usable as they are.

export const CLIENT_OPS = ['MOVE', 'SAY', 'CAST', 'HOOK', 'REEL_DONE', 'CANCEL', 'BOOK_PLACE', 'GOTO_FRIEND', 'EMOTE', 'SELL', 'SALVAGE', 'MERGE', 'CRAFT'];
export const SERVER_OPS = ['SNAPSHOT', 'PLAYER_ENTER', 'PLAYER_LEAVE', 'BUBBLE', 'CORRECTION', 'WELCOME', 'BOBBER', 'REEL_START', 'FISH_END', 'BOOK_RESULT', 'TELEPORT', 'EMOTE_SHOW', 'ECONOMY_RESULT', 'CRAFT_RESULT'];

const item = (defId = 'lake.fish.pike', tier = 'rare', float = 0.0312) => ({
  instanceId: '00000000-0000-4000-8000-000000000001',
  defId,
  tier,
  float,
  source: 'fishing',
  obtainedAt: Date.now(),
});

/** Client → server bodies. */
export function clientTemplates(ctx) {
  const me = ctx.me || { x: 64.5, y: 50.5 };
  const ids = ctx.itemIds || [];
  return {
    MOVE: [['yürü', { seq: (ctx.seq || 0) + 1, x: me.x - 0.4, y: me.y, dir: 'left', moving: true }], ['hile: 10 tile ışınlan', { seq: (ctx.seq || 0) + 1, x: me.x - 10, y: me.y, dir: 'left', moving: true }]],
    SAY: [['selam', { text: 'selam millet' }], ['121 karakter', { text: 'x'.repeat(121) }], ['boş', { text: '   ' }]],
    CAST: [['göle (derin)', { x: 100.5, y: 40.5 }], ['karaya (NOT_WATER)', { x: me.x + 1, y: me.y }]],
    HOOK: [['çek', {}]],
    REEL_DONE: [['girdi yok', { inputs: [] }], ['bozuk (azalan)', { inputs: [500, 100] }]],
    CANCEL: [['topla', {}]],
    BOOK_PLACE: [['ilk çanta eşyası', { instanceId: ids[0] || 'instance-id' }], ['olmayan eşya', { instanceId: 'nope' }]],
    GOTO_FRIEND: [['arkadaş', { userId: ctx.otherId || 'user-id' }]],
    EMOTE: [['wave', { emote: 'wave' }], ['show_fish', { emote: 'show_fish' }], ['listede yok', { emote: 'kiss' }]],
    SELL: [['ilk eşya', { items: ids.slice(0, 1) }], ['5 çöp', { stacks: [{ defId: 'lake.junk.boot', count: 5 }] }], ['41 satır (TOO_MANY)', { items: Array.from({ length: 41 }, (_, i) => `x${i}`) }]],
    SALVAGE: [['ilk eşya', { items: ids.slice(0, 1) }], ['recipe (CANNOT_SALVAGE)', { stacks: [{ defId: 'recipe.scale_charm', count: 1 }] }]],
    MERGE: [['ilk 3 eşya', { items: ids.slice(0, 3) }]],
    CRAFT: [['pul tılsımı', { recipeId: 'recipe.scale_charm' }], ['yosun çelengi', { recipeId: 'recipe.moss_wreath' }], ['turna kupası', { recipeId: 'recipe.pike_trophy', items: ids.slice(0, 2) }], ['tarifsiz', { recipeId: 'recipe.nope' }]],
  };
}

/** Server → client bodies, pushed to a player to test how the client shows them. */
export function serverTemplates(ctx) {
  const id = ctx.targetId || 'user-id';
  const other = ctx.otherId || '11111111-1111-4111-8111-111111111111';
  return {
    SNAPSHOT: [['bir oyuncu yürüyor', { t: 0, players: [{ id: other, x: 66, y: 51, dir: 'right', moving: true }] }]],
    PLAYER_ENTER: [['hayalet oyuncu', { id: other, name: 'hayalet', characterId: 'default', x: 66, y: 51, dir: 'down', moving: false }], ['balık tutan', { id: other, name: 'balikci', characterId: 'default', x: 80, y: 47.5, dir: 'right', moving: false, bobber: { x: 86, y: 47.5, band: 'mid' } }]],
    PLAYER_LEAVE: [['hayalet gider', { id: other }]],
    BUBBLE: [['kendi balonu', { id, text: 'dev push' }], ['hayaletin balonu', { id: other, text: 'merhaba!' }]],
    CORRECTION: [['meydana düzelt', { seq: 0, x: 64.5, y: 50.5 }]],
    WELCOME: [['yeniden hoş geldin', { you: { id, x: 64.5, y: 50.5 }, serverName: 'Test', energy: 42, energyMax: 100 }]],
    BOBBER: [['vuruş (bite)', { id, x: 86, y: 47.5, band: 'mid', state: 'bite' }], ['sahte kıpırdama', { id, x: 86, y: 47.5, band: 'mid', state: 'twitch' }]],
    REEL_START: [['mythic çekme', { seed: 12345, params: { barSize: 230, lift: 3, gravity: 2, maxVel: 18, fishSpeed: 6, retargetSteps: 22, gain: 2, loss: 1, maxSteps: 1500, maxMs: 30000 } }]],
    FISH_END: [
      ['yeni keşif + sayfa tamam', { id, outcome: 'caught', defId: 'lake.fish.catfish', item: item('lake.fish.catfish', 'epic', 0.012), energy: 50, book: { page: 'lake_fish', kind: 'discovered', pageComplete: true, luck: 0.07, score: 140 } }],
      ['yeni keşif', { id, outcome: 'caught', defId: 'lake.fish.pike', item: item(), energy: 50, book: { page: 'lake_fish', kind: 'discovered', pageComplete: false, luck: 0.02, score: 4 } }],
      ['kopya, daha iyi', { id, outcome: 'caught', defId: 'lake.fish.pike', item: item(), energy: 50, book: { page: 'lake_fish', kind: 'copy', better: true } }],
      ['mythic', { id, outcome: 'caught', defId: 'lake.item.blue_crystal', item: item('lake.item.blue_crystal', 'mythic', 0.0007), energy: 50, book: { page: 'deep_water', kind: 'discovered', pageComplete: true, luck: 0.12, score: 300 } }],
      ['çöp yığını', { id, outcome: 'caught', defId: 'lake.junk.boot', stack: { defId: 'lake.junk.boot', count: 7 }, energy: 50 }],
      ['kaçtı', { id, outcome: 'escaped', energy: 50 }],
      ['erken çekti', { id, outcome: 'missed', energy: 50 }],
      ['çanta dolu', { id, outcome: 'rejected', reason: 'BAG_FULL', energy: 50 }],
    ],
    BOOK_RESULT: [['yuvaya kondu', { ok: true, defId: 'lake.fish.pike', page: 'lake_fish', slot: item(), score: 12 }], ['NOT_FOUND', { ok: false, reason: 'NOT_FOUND', defId: 'lake.fish.pike' }]],
    TELEPORT: [['meydana', { x: 64.5, y: 50.5 }], ['RATE_LIMITED', { x: 64.5, y: 50.5, reason: 'RATE_LIMITED' }]],
    EMOTE_SHOW: [['dans', { id, emote: 'dance' }], ['balık göster', { id, emote: 'show_fish', defId: 'lake.fish.golden_carp' }]],
    ECONOMY_RESULT: [['satış', { action: 'sell', ok: true, coin: 1234, dust: 50, gained: 75, items: [], stacks: [] }], ['NOT_ENOUGH', { action: 'sell', ok: false, reason: 'NOT_ENOUGH', coin: 1234, dust: 50 }]],
    CRAFT_RESULT: [['craft + keşif', { action: 'craft', ok: true, dust: 80, item: item('craft.scale_charm', 'common', 0.04), book: { page: 'crafts', kind: 'discovered', pageComplete: false, luck: 0.02, score: 5 }, items: [], stacks: [{ defId: 'lake.mat.scale', count: 3 }] }], ['NOT_ENOUGH_DUST', { action: 'merge', ok: false, reason: 'NOT_ENOUGH_DUST', dust: 3 }]],
  };
}

/** RPCs the dashboard knows, with an example payload each. */
export function rpcTemplates(ctx) {
  const userId = ctx.targetId || '';
  return {
    healthcheck: {},
    list_servers: {},
    get_inventory: {},
    get_book: { userId },
    get_profile: { userId },
    set_profile: { showcase: [], hunting: null },
    friends_status: {},
    dev_info: {},
    dev_users: { query: '', limit: 50 },
    dev_player: { userId },
    dev_world: {},
    dev_give: { userId, defId: 'lake.fish.pike', count: 1, float: 0.01, bag: false },
    dev_item_edit: { userId, instanceId: '', float: 0.001, tier: 'mythic' },
    dev_item_delete: { userId, instanceIds: [], all: false },
    dev_stacks: { userId, stacks: { 'lake.mat.scale': 99 }, clear: false },
    dev_wallet: { userId, set: { coin: 10000, dust: 10000 } },
    dev_energy: { userId, value: 100 },
    dev_book: { userId, action: 'fill_page', page: 'lake_fish' },
    dev_profile: { userId, showcase: ['lake.fish.pike'], hunting: 'lake.item.blue_crystal' },
    dev_friends: { a: userId, b: ctx.otherId || '', action: 'befriend' },
    dev_reset: { userId },
    dev_live: { userId, action: 'force', defId: 'lake.item.blue_crystal' },
    dev_sim_catch: { n: 10000, band: 'deep', hasEnergy: true, luck: 0 },
    dev_reel: { tier: 'mythic', seed: 42 },
    dev_craft_preview: { recipeId: 'recipe.pike_trophy', average: 0.03 },
    dev_suspects: { limit: 500 },
    dev_watch: { userId, action: 'transfer', to: ctx.otherId || '', value: 500, n: 4 },
  };
}
