// End-to-end check against a running local Nakama (docker compose up -d).
// Two fake players log in, walk, cheat, chat and leave. Run: npm run smoke
import { Client } from '@heroiclabs/nakama-js';

const OP = {
  MOVE: 1, SNAPSHOT: 2, PLAYER_ENTER: 3, PLAYER_LEAVE: 4, SAY: 5, BUBBLE: 6, CORRECTION: 7, WELCOME: 8,
  CAST: 9, BOBBER: 10, HOOK: 11, REEL_START: 12, REEL_DONE: 13, FISH_END: 14, CANCEL: 15, BOOK_PLACE: 16, BOOK_RESULT: 17,
  GOTO_FRIEND: 18, TELEPORT: 19, EMOTE: 20, EMOTE_SHOW: 21, SELL: 22, SALVAGE: 23, ECONOMY_RESULT: 24, MERGE: 25, CRAFT: 26, CRAFT_RESULT: 27,
  REPAIR_ROD: 28, BUY_BAIT: 29, SHOP_RESULT: 30, STASH_OPEN: 31, STASH_PUT: 32, STASH_TAKE: 33, STASH_EXPAND: 34, STASH_RESULT: 35,
  EMOTE_STATUS: 36, EMOTE_STATUS_SHOW: 37,
  TRADE_OFFER: 39, TRADE_REPLY: 40, TRADE_SET: 41, TRADE_LOCK: 42, TRADE_CONFIRM: 43, TRADE_CANCEL: 44, TRADE_INVITE: 45, TRADE_STATE: 46, TRADE_END: 47,
  ITEM_LOCK: 48, ITEM_LOCK_RESULT: 49,
  STALL_OPEN: 50, STALL_RECALL: 51, STALL_VIEW: 52, STALL_BUY: 53, STALL_LIST: 54, STALL_STATE: 55, STALL_RESULT: 56,
  QUEST_STATE: 57, QUEST_CLAIM: 58, QUEST_CLAIM_RESULT: 59,
  BOARD_AD: 60, BOARD_STATE: 61, BOARD_RESULT: 62, BOARD_GOTO: 63,
};
const client = new Client('defaultkey', process.env.NAKAMA_HOST || '127.0.0.1', '7350', false);
const run = Date.now().toString(36);
let failed = 0;

function check(ok, what) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Calls an RPC that should fail and returns our error code ('' if it did not fail). */
async function rpcError(p, id, body) {
  try {
    await client.rpc(p.session, id, body);
    return '';
  } catch (e) {
    try {
      const j = typeof e.json === 'function' ? await e.json() : e;
      return JSON.parse(j.message || j.error).code;
    } catch (_x) {
      return 'UNREADABLE';
    }
  }
}

async function player(name, deviceId = `smoke-${name}-${run}`) {
  const session = await client.authenticateDevice(deviceId, true, `${name}_${run}`.slice(0, 16));
  const socket = client.createSocket(false, false);
  const inbox = [];
  socket.onmatchdata = (m) => inbox.push({ op: m.op_code, body: JSON.parse(new TextDecoder().decode(m.data)) });
  const notes = [];
  socket.onnotification = (n) => notes.push(n);
  await socket.connect(session, true);
  const p = { session, socket, inbox, notes, seq: 0 };
  p.take = (op) => inbox.filter((m) => m.op === op).map((m) => m.body);
  p.clear = () => (inbox.length = 0);
  p.send = (op, body) => socket.sendMatchState(p.matchId, op, JSON.stringify(body));
  p.join = async (matchId, meta = { protocolVersion: '1', characterId: 'default' }) => {
    p.matchId = matchId;
    return socket.joinMatch(matchId, undefined, meta);
  };
  return p;
}

const listServers = async (session) => (await client.rpc(session, 'list_servers', {})).payload;

// Login rules
try {
  await client.authenticateDevice(`smoke-bad-${run}`, true, 'a b!');
  check(false, 'bad username is rejected');
} catch (_e) {
  check(true, 'bad username is rejected');
}

const a = await player('ayse');
const b = await player('bora');
const { servers } = await listServers(a.session);
check(servers.length >= 1 && servers.every((s) => s.matchId && s.name && s.language && s.capacity === 200), 'list_servers returns servers');
const target = servers[0];

try {
  await a.socket.joinMatch(target.matchId, undefined, { protocolVersion: '99' });
  check(false, 'wrong protocol version is rejected');
} catch (e) {
  check(String(e.message || JSON.stringify(e)).includes('PROTOCOL_MISMATCH'), 'wrong protocol version is rejected');
}

await a.join(target.matchId);
await b.join(target.matchId);
await sleep(400);
const welcome = a.take(OP.WELCOME)[0];
check(!!welcome && welcome.serverName === target.name, 'WELCOME arrives with server name');
const start = { x: welcome.you.x, y: welcome.you.y };
check(a.take(OP.PLAYER_ENTER).some((e) => e.id === b.session.user_id && e.name), 'A sees B enter');
check(b.take(OP.PLAYER_ENTER).some((e) => e.id === a.session.user_id), 'B sees A enter');
const after = await listServers(a.session);
check(after.servers.find((s) => s.matchId === target.matchId).players >= 2, 'list_servers counts players');

// Walk west at 4 tiles/s, 10 messages a second
b.clear();
let x = start.x;
for (let i = 0; i < 5; i++) {
  x -= 0.4;
  a.send(OP.MOVE, { seq: ++a.seq, x, y: start.y, dir: 'left', moving: true });
  await sleep(100);
}
await sleep(300);
const snaps = b.take(OP.SNAPSHOT).flatMap((s) => s.players).filter((p) => p.id === a.session.user_id);
check(snaps.length > 0 && Math.abs(snaps[snaps.length - 1].x - x) < 1e-6, 'B gets A\'s walk in SNAPSHOT');
check(a.take(OP.CORRECTION).length === 0, 'honest walk gets no CORRECTION');

// Teleport cheat
a.clear();
a.send(OP.MOVE, { seq: ++a.seq, x: x - 10, y: start.y, dir: 'left', moving: true });
await sleep(300);
const fix = a.take(OP.CORRECTION)[0];
check(!!fix && Math.abs(fix.x - x) < 1e-6, 'teleport gets CORRECTION to last good spot');

// Walking into the lake (east of the pier row)
a.send(OP.MOVE, { seq: ++a.seq, x: 100, y: 40, dir: 'right', moving: true });
await sleep(300);
check(a.take(OP.CORRECTION).length >= 1, 'far jump is corrected');

// Chat
a.clear();
b.clear();
a.send(OP.SAY, { text: '  selam   millet ' });
a.send(OP.SAY, { text: 'spam' });
await sleep(300);
const bubbles = b.take(OP.BUBBLE);
check(bubbles.length === 1 && bubbles[0].text === 'selam millet', 'B hears one trimmed bubble, spam dropped');
check(a.take(OP.BUBBLE).length === 1, 'speaker gets own bubble');

// Same account reconnects: old socket is kicked, place is kept
const a2 = await player('ayse');
await a2.join(target.matchId);
await sleep(400);
const w2 = a2.take(OP.WELCOME)[0];
check(!!w2 && Math.abs(w2.you.x - x) < 1e-6, 'reconnect keeps position');

// Leave and come back: position is saved
b.clear();
await a2.socket.leaveMatch(target.matchId);
await sleep(400);
check(b.take(OP.PLAYER_LEAVE).some((l) => l.id === a.session.user_id), 'B sees A leave');
const a3 = await player('ayse');
await a3.join(target.matchId);
await sleep(400);
const w3 = a3.take(OP.WELCOME)[0];
check(!!w3 && Math.abs(w3.you.x - x) < 1e-6, 'rejoin starts at saved position');


// Fishing (Faz 2): walk to the pier, get refused a few times, then catch something.
const c = await player('cem');
await c.join(target.matchId);
await sleep(400);
const wc = c.take(OP.WELCOME)[0];
check(!!wc && wc.energy >= 1 && wc.energyMax === 100, 'WELCOME carries energy');
const pos = { x: wc.you.x, y: wc.you.y };
async function walkTo(p, to) {
  while (Math.abs(pos.x - to.x) > 1e-6 || Math.abs(pos.y - to.y) > 1e-6) {
    const dx = Math.max(-0.35, Math.min(0.35, to.x - pos.x));
    const dy = Math.max(-0.35, Math.min(0.35, to.y - pos.y));
    pos.x += dx;
    pos.y += dy;
    p.send(OP.MOVE, { seq: ++p.seq, x: pos.x, y: pos.y, dir: dx > 0 ? 'right' : 'up', moving: true });
    await sleep(100);
  }
  await sleep(300);
}
const lastEnd = async (p, ms = 400) => {
  await sleep(ms);
  const ends = p.take(OP.FISH_END);
  return ends[ends.length - 1];
};

c.clear();
c.send(OP.CAST, { x: 88.5, y: 47.5 });
check((await lastEnd(c))?.reason === 'NOT_NEAR_WATER', 'cast far from water is refused (NOT_NEAR_WATER)');

await walkTo(c, { x: 74.5, y: 50.5 });
await walkTo(c, { x: 74.5, y: 47.5 });
await walkTo(c, { x: 85.4, y: 47.5 });
check(c.take(OP.CORRECTION).length === 0, 'walk to the pier end gets no CORRECTION');

c.clear();
c.send(OP.CAST, { x: 80.5, y: 47.5 });
check((await lastEnd(c))?.reason === 'NOT_WATER', 'cast onto the pier is refused (NOT_WATER)');
c.send(OP.CAST, { x: 100.5, y: 47.5 });
check((await lastEnd(c))?.reason === 'TOO_FAR', 'cast too far is refused (TOO_FAR)');

// Cast, then step away: fishing is cancelled
c.clear();
c.send(OP.CAST, { x: 88.5, y: 47.5 });
await sleep(300);
const cast = c.take(OP.BOBBER)[0];
check(!!cast && cast.state === 'cast' && cast.band && cast.energy === wc.energy - 1, 'cast shows a bobber with a water band and new energy');
await walkTo(c, { x: 85.0, y: 47.5 });
check((await lastEnd(c, 100))?.outcome === 'cancelled', 'moving cancels fishing');

// Cast, wait for the bite, hook and play the reel well. Returns FISH_END or null.
async function catchOne(p, extra = {}) {
  p.clear();
  p.hooked = false;
  p.send(OP.CAST, { x: 88.5, y: 47.5, ...extra });
  let reel;
  for (let t = 0; t < 250 && !reel; t++) {
    await sleep(100);
    if (p.inbox.some((m) => m.op === OP.BOBBER && m.body.state === 'bite') && !p.hooked) {
      p.hooked = true;
      p.send(OP.HOOK, {});
    }
    reel = p.take(OP.REEL_START)[0];
  }
  p.lastBobbers = p.take(OP.BOBBER);
  p.lastReel = reel;
  if (!reel) return null;
  const inputs = bot(reel.seed, reel.params);
  await sleep(simulate(reel.seed, reel.params, inputs) * 20);
  p.send(OP.REEL_DONE, { inputs });
  return (await lastEnd(p, 600)) || null;
}
const inBag = (inv, defId) => inv.items.some((i) => i.defId === defId) || inv.stacks.some((s) => s.defId === defId);

const done = await catchOne(c);
check(c.lastBobbers.some((m) => m.state === 'twitch' || m.state === 'bite'), 'bobber twitches or bites');
check(!!c.lastReel && c.lastReel.seed >= 0 && c.lastReel.params?.barSize > 0, 'HOOK on the bite starts the reel game');
check(done?.outcome === 'caught' && done.defId && (done.item || done.stack), 'good reel catches something');
const inv = (await client.rpc(c.session, 'get_inventory', {})).payload;
const discovered = done?.book?.kind === 'discovered';
check((discovered ? !inBag(inv, done.defId) : inBag(inv, done?.defId)) && inv.energy === wc.energy - 2 && inv.slotsMax === 40,
  'get_inventory shows the catch (or not, if it went to the book) and spent energy');
if (done?.item) check(done.item.float >= 0 && done.item.float <= 1 && done.item.tier, 'item has Tier and Float');

// Faz 4 price and recipe list for the client windows.
const cat = (await client.rpc(c.session, 'get_catalog', {})).payload;
check(cat.tiers?.length === 5 && cat.recipes?.length > 0 && cat.baits?.length > 0 && cat.stash?.tiers?.length > 0, 'get_catalog lists prices, recipes, baits and stash tiers');

// Collection Book (Faz 3): fish until a Tier item comes up; the first copy goes to its slot.
let first = done?.book?.kind === 'discovered' ? done : null;
for (let i = 0; i < 8 && !first; i++) {
  const d = await catchOne(c);
  if (d?.book?.kind === 'discovered') first = d;
}
check(!!first && first.book.page && first.book.score > 0 && typeof first.book.luck === 'number', 'first Tier catch is a "Yeni keşif!" with page, score and luck');
if (first) {
  const book = (await client.rpc(c.session, 'get_book', {})).payload;
  const rec = book.pages.flatMap((pg) => pg.records).find((r) => r.defId === first.defId);
  check(rec?.state === 'filled' && rec.item?.instanceId === first.item.instanceId, 'get_book shows the item in its slot');
  check(book.pages.flatMap((pg) => pg.records).some((r) => r.state === 'unknown' && !r.defId), 'unknown records hide their id');
  const invNow = (await client.rpc(c.session, 'get_inventory', {})).payload;
  check(!invNow.items.some((i) => i.instanceId === first.item.instanceId), 'book item takes no bag slot');
  const other = (await client.rpc(b.session, 'get_book', { userId: c.session.user_id })).payload;
  check(other.userId === c.session.user_id && other.score === book.score, 'others can view the book');

  // Profile card: showcase from book slots and "Arıyorum"
  const set = (await client.rpc(c.session, 'set_profile', { showcase: [first.defId], hunting: 'lake.item.blue_crystal' })).payload;
  check(set.showcase.length === 1 && set.showcase[0].instanceId === first.item.instanceId, 'set_profile puts a book item in the showcase');
  const card = (await client.rpc(b.session, 'get_profile', { userId: c.session.user_id })).payload;
  check(card.username && card.hunting === 'lake.item.blue_crystal' && card.showcase[0]?.defId === first.defId && card.score === book.score,
    'others see the profile card');
  try {
    await client.rpc(c.session, 'set_profile', { showcase: ['lake.junk.boot'] });
    check(false, 'showcase refuses items that are not in the book');
  } catch (_e) {
    check(true, 'showcase refuses items that are not in the book');
  }
}
c.clear();
c.send(OP.BOOK_PLACE, { instanceId: 'not-an-item' });
await sleep(300);
check(c.take(OP.BOOK_RESULT)[0]?.reason === 'NOT_OWNED', 'BOOK_PLACE with an unknown item is refused');

// Economy (Faz 4): sell and salvage what is in the bag; book items cannot be sold.
const isRecipe = (defId) => defId.startsWith('recipe.');
let bag = (await client.rpc(c.session, 'get_inventory', {})).payload;
check(['recipe.scale_charm', 'recipe.moss_wreath'].every((id) => bag.stacks.some((s) => s.defId === id && s.count >= 1)), 'a new account gets the starter recipes');
for (let i = 0; i < 8 && bag.items.length + bag.stacks.filter((s) => !isRecipe(s.defId)).length < 2; i++) {
  await catchOne(c);
  bag = (await client.rpc(c.session, 'get_inventory', {})).payload;
}
check(bag.coin === 0 && bag.dust === 0, 'a new player starts with 0 Coin and 0 dust');
const lines = [...bag.items.map((i) => ({ items: [i.instanceId] })), ...bag.stacks.filter((s) => !isRecipe(s.defId)).map((s) => ({ stacks: [{ defId: s.defId, count: s.count }] }))];
async function economy(op, body) {
  c.clear();
  c.send(op, body);
  await sleep(300);
  return c.take(OP.ECONOMY_RESULT)[0];
}
// What the client windows would show before the click, worked out from get_catalog only.
const conditionMult = (float) => (cat.conditions.find((b) => float >= b.min && float < b.max) || cat.conditions[cat.conditions.length - 1]).multiplier;
const previewSell = (items, stacks) =>
  items.reduce((n, id) => { const it = bag.items.find((i) => i.instanceId === id); return n + Math.max(1, Math.round(cat.tiers.find((t) => t.tier === it.tier).sell * conditionMult(it.float))); }, 0) +
  stacks.reduce((n, st) => n + cat.stacks.find((x) => x.defId === st.defId).sell * st.count, 0);
const previewDust = (items, stacks) =>
  items.reduce((n, id) => n + cat.tiers.find((t) => t.tier === bag.items.find((i) => i.instanceId === id).tier).dust, 0) +
  stacks.reduce((n, st) => n + cat.stacks.find((x) => x.defId === st.defId).dust * st.count, 0);
const rest = lines.slice(1);
const restItems = rest.flatMap((l) => l.items || []);
const restStacks = rest.flatMap((l) => l.stacks || []);
const expectDust = previewDust(lines[0].items || [], lines[0].stacks || []);
const expectCoin = previewSell(restItems, restStacks);
const salvaged = await economy(OP.SALVAGE, lines[0]);
check(salvaged?.ok && salvaged.dust === salvaged.gained && salvaged.gained > 0 && salvaged.coin === 0, 'SALVAGE turns a bag line into dust');
check(salvaged?.gained === expectDust, 'get_catalog predicts the salvage dust exactly');
const sold = rest.length === 0 ? null : await economy(OP.SELL, {
  items: rest.flatMap((l) => l.items || []),
  stacks: rest.flatMap((l) => l.stacks || []),
});
check(!sold || (sold.ok && sold.coin === sold.gained && sold.gained > 0 && sold.dust === salvaged.dust), 'SELL turns the rest into Coin');
check(!sold || sold.gained === expectCoin, 'get_catalog predicts the sell price exactly (Tier x condition, junk and material per unit)');
const emptied = (await client.rpc(c.session, 'get_inventory', {})).payload;
check(emptied.items.length === 0 && emptied.stacks.every((x) => isRecipe(x.defId)) && emptied.coin === (sold ? sold.coin : 0) && emptied.dust === salvaged?.dust,
  'get_inventory shows an empty bag and the new balances');
check((await economy(OP.SELL, { items: lines[0].items || ['gone'] }))?.reason === 'NOT_OWNED', 'selling the same thing twice is refused');
if (first) check((await economy(OP.SELL, { items: [first.item.instanceId] }))?.reason === 'NOT_OWNED', 'a book slot item cannot be sold');
check((await economy(OP.SALVAGE, { stacks: [{ defId: 'lake.junk.boot', count: 0 }] }))?.reason === 'BAD_REQUEST', 'a bad request is refused');

// Fake REEL_DONE without a reel game is ignored
c.clear();
c.send(OP.REEL_DONE, { inputs: [20, 40] });
check((await lastEnd(c)) === undefined, 'REEL_DONE without a reel is ignored');


// Merge and craft (Faz 4). A fresh player gets its inputs through the Nakama
// console API before joining, since the match caches the bag on join.
async function consoleApi(path, method, body, token) {
  const res = await fetch(`http://${process.env.NAKAMA_HOST || '127.0.0.1'}:7351${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return res.json();
}
const admin = (await consoleApi('/v2/console/authenticate', 'POST', { username: 'admin', password: 'password' })).token;
const d = await player('deniz');
const uid = d.session.user_id;
const seedWrite = (collection, key, value) =>
  consoleApi(`/v2/console/storage/${collection}/${key}/${uid}`, 'PUT', { value: JSON.stringify(value), version: '', permission_read: 1, permission_write: 0 }, admin);
const carp = (n, float) => ({ instanceId: `smoke-carp-${n}-${run}`, defId: 'lake.fish.carp', tier: 'common', float, source: 'fishing', obtainedAt: Date.now() });
await seedWrite('bag', 'stacks', { stacks: { 'recipe.scale_charm': 1, 'recipe.moss_wreath': 1, 'lake.mat.scale': 5, 'lake.mat.moss': 1 } });
for (const [n, fl] of [[1, 0.3], [2, 0.6], [3, 0.45], [4, 0.9]]) await seedWrite('items', carp(n, fl).instanceId, carp(n, fl));
await consoleApi(`/v2/console/account/${uid}`, 'POST', { wallet: JSON.stringify({ dust: 25 }) }, admin);
await d.join(target.matchId);
await sleep(400);
async function craftOp(op, body) {
  d.clear();
  d.send(op, body);
  await sleep(300);
  return d.take(OP.CRAFT_RESULT)[0];
}
const ids = [1, 2, 3].map((n) => carp(n, 0).instanceId);
check((await craftOp(OP.MERGE, { items: [ids[0], ids[1], 'nope'] }))?.reason === 'NOT_OWNED', 'MERGE with an item not owned is refused');
const merged = await craftOp(OP.MERGE, { items: ids });
check(cat.tiers.find((t) => t.tier === 'common').merge === 10 && cat.mergeCount === 3, 'get_catalog lists the merge cost the server charges');
check(merged?.ok && merged.item.defId === 'lake.fish.carp' && merged.item.source === 'merge' && merged.item.float <= 0.6 && merged.dust === 15 && merged.items.length === 3,
  'MERGE turns three carps and 10 dust into one carp no worse than the worst');
check((await craftOp(OP.CRAFT, { recipeId: 'recipe.moss_wreath' }))?.reason === 'MISSING_INPUTS', 'CRAFT without the materials is refused');
check((await craftOp(OP.CRAFT, { recipeId: 'recipe.pike_trophy' }))?.reason === 'NO_RECIPE', 'CRAFT without the recipe is refused');
check((await craftOp(OP.CRAFT, { recipeId: 'recipe.scale_charm' }))?.reason === 'NOT_ENOUGH_DUST', 'CRAFT without enough dust is refused');
await consoleApi(`/v2/console/account/${uid}`, 'POST', { wallet: JSON.stringify({ dust: 40 }) }, admin);
const crafted = await craftOp(OP.CRAFT, { recipeId: 'recipe.scale_charm' });
check(crafted?.ok && crafted.item.defId === 'craft.scale_charm' && crafted.item.source === 'craft' && crafted.dust === 20 && crafted.book?.kind === 'discovered' && crafted.book.page === 'crafts',
  'CRAFT spends recipe, materials and dust, and the first crafted item goes to its book slot');
check(cat.recipes.find((r) => r.id === 'recipe.scale_charm')?.dust === 20, 'get_catalog lists the craft dust the server charged');
const dInv = (await client.rpc(d.session, 'get_inventory', {})).payload;
const st = Object.fromEntries(dInv.stacks.map((x) => [x.defId, x.count]));
check(!st['recipe.scale_charm'] && st['lake.mat.scale'] === 2 && !st['lake.mat.moss'] && dInv.dust === 20 &&
  dInv.items.some((i) => i.instanceId === carp(4, 0).instanceId) && !dInv.items.some((i) => ids.includes(i.instanceId)),
  'get_inventory shows what merge and craft used up');
await d.socket.leaveMatch(target.matchId);

// Rod, special bait and the stash (Faz 4). Seeded like the craft player: a broken rod,
// Coin, the bait recipe and its materials, and one fish to store.
const e = await player('ege');
const eid = e.session.user_id;
const seedE = (collection, key, value) =>
  consoleApi(`/v2/console/storage/${collection}/${key}/${eid}`, 'PUT', { value: JSON.stringify(value), version: '', permission_read: 1, permission_write: 0 }, admin);
const perch = { instanceId: `smoke-perch-${run}`, defId: 'lake.fish.perch', tier: 'common', float: 0.4, source: 'fishing', obtainedAt: Date.now() };
await seedE('player', 'rod', { level: 1, durability: 0 });
await seedE('bag', 'stacks', { stacks: { 'recipe.shiny_bait': 1, 'lake.mat.scale': 2, 'lake.junk.shell': 4 } });
await seedE('items', perch.instanceId, perch);
await consoleApi(`/v2/console/account/${eid}`, 'POST', { wallet: JSON.stringify({ coin: 3000, dust: 10 }) }, admin);
await e.join(target.matchId);
await sleep(400);
const we = e.take(OP.WELCOME)[0];
check(we?.rod?.level === 1 && we.rod.durability === 0 && we.rod.max === 200, 'WELCOME carries the rod');
const epos = { x: we.you.x, y: we.you.y };
async function walkE(to) {
  while (Math.abs(epos.x - to.x) > 1e-6 || Math.abs(epos.y - to.y) > 1e-6) {
    const dx = Math.max(-0.35, Math.min(0.35, to.x - epos.x));
    const dy = Math.max(-0.35, Math.min(0.35, to.y - epos.y));
    epos.x += dx;
    epos.y += dy;
    e.send(OP.MOVE, { seq: ++e.seq, x: epos.x, y: epos.y, dir: dx > 0 ? 'right' : 'up', moving: true });
    await sleep(100);
  }
  await sleep(300);
}
async function eOp(op, body, reply) {
  e.clear();
  e.send(op, body);
  await sleep(300);
  return e.take(reply)[0];
}
const eEnd = async () => {
  await sleep(400);
  const ends = e.take(OP.FISH_END);
  return ends[ends.length - 1];
};
for (const to of [{ x: 74.5, y: 50.5 }, { x: 74.5, y: 47.5 }, { x: 85.4, y: 47.5 }]) await walkE(to);

const bought = await eOp(OP.BUY_BAIT, { defId: 'bait.shiny', count: 3 }, OP.SHOP_RESULT);
check(bought?.ok && bought.spent === 15 && bought.coin === 2985 && bought.stack?.count === 3, 'BUY_BAIT puts 3 Parlak yem in the bag for 15 Coin');
check(cat.baits.find((x) => x.defId === 'bait.shiny')?.price * 3 === bought.spent, 'get_catalog lists the bait price the server charged');
check((await eOp(OP.BUY_BAIT, { defId: 'bait.gold', count: 1 }, OP.SHOP_RESULT))?.reason === 'BAD_REQUEST', 'unknown bait cannot be bought');
e.clear();
e.send(OP.CAST, { x: 88.5, y: 47.5, bait: 'bait.crystal' });
check((await eEnd())?.reason === 'NO_BAIT', 'cast with bait not in the bag is refused (NO_BAIT)');
e.send(OP.CAST, { x: 88.5, y: 47.5, bait: 'bait.shiny' });
check((await eEnd())?.reason === 'ROD_BROKEN', 'cast with bait and a broken rod is refused (ROD_BROKEN)');
e.clear();
e.send(OP.CAST, { x: 88.5, y: 47.5 });
await sleep(300);
const brokenCast = e.take(OP.BOBBER)[0];
check(brokenCast?.state === 'cast' && brokenCast.energy === we.energy, 'a broken rod still fishes but spends no energy');
e.send(OP.CANCEL, {});
await eEnd();

const repaired = await eOp(OP.REPAIR_ROD, {}, OP.SHOP_RESULT);
check(repaired?.ok && repaired.spent === 100 && repaired.coin === 2885 && repaired.rod?.durability === 200, 'REPAIR_ROD fixes the whole rod for 100 Coin');
check(cat.rodLevels.find((l) => l.level === 1)?.fullRepair === repaired.spent, 'get_catalog lists the repair cost the server charged');
check((await eOp(OP.REPAIR_ROD, {}, OP.SHOP_RESULT))?.reason === 'NOT_NEEDED', 'repairing a whole rod is refused');

const baited = await catchOne(e, { bait: 'bait.shiny' });
const castMsg = e.lastBobbers.find((m) => m.state === 'cast');
check(castMsg?.bait?.defId === 'bait.shiny' && castMsg.bait.count === 2 && castMsg.energy === we.energy - 1, 'a cast with bait spends one bait and one energy');
check(baited?.outcome === 'caught' && baited.rod?.durability === 199, 'a catch with energy wears the rod by one');
const eInv = (await client.rpc(e.session, 'get_inventory', {})).payload;
check(eInv.rod?.durability === 199 && eInv.stacks.some((x) => x.defId === 'bait.shiny' && x.count === 2), 'get_inventory shows the rod and the bait left');

const baitCraft = await eOp(OP.CRAFT, { recipeId: 'recipe.shiny_bait' }, OP.CRAFT_RESULT);
check(baitCraft?.ok && baitCraft.stack?.defId === 'bait.shiny' && baitCraft.stack.count === 7 && !baitCraft.item && baitCraft.dust === 0, 'CRAFT of the bait recipe makes 5 Parlak yem');

check((await eOp(OP.STASH_OPEN, {}, OP.STASH_RESULT))?.reason === 'NOT_AT_BANK', 'the stash does not open away from the bank');
for (const to of [{ x: 74.5, y: 47.5 }, { x: 74.5, y: 50.5 }, { x: cat.stash.x, y: cat.stash.y }]) await walkE(to);
check(e.take(OP.CORRECTION).length === 0, 'walk to the bank gets no CORRECTION');
const opened = await eOp(OP.STASH_OPEN, {}, OP.STASH_RESULT);
check(opened?.ok && opened.stash.level === 0 && opened.stash.slotsMax === 100 && opened.stash.slotsUsed === 0, 'STASH_OPEN at the bank shows an empty 100-slot stash');
const put = await eOp(OP.STASH_PUT, { items: [perch.instanceId], stacks: [{ defId: 'lake.junk.shell', count: 3 }] }, OP.STASH_RESULT);
check(put?.ok && put.stash.slotsUsed === 2 && put.stash.items[0]?.instanceId === perch.instanceId && put.stash.stacks[0]?.count === 3, 'STASH_PUT moves an item and a stack into the stash');
const eInv2 = (await client.rpc(e.session, 'get_inventory', {})).payload;
check(!eInv2.items.some((i) => i.instanceId === perch.instanceId) && !eInv2.stacks.some((x) => x.defId === 'lake.junk.shell'), 'stashed things leave the bag');
check((await eOp(OP.SELL, { items: [perch.instanceId] }, OP.ECONOMY_RESULT))?.reason === 'NOT_OWNED', 'a stashed item cannot be sold');
check((await eOp(OP.STASH_TAKE, { stacks: [{ defId: 'lake.junk.shell', count: 4 }] }, OP.STASH_RESULT))?.reason === 'NOT_ENOUGH', 'taking more than the stash has is refused');
const took = await eOp(OP.STASH_TAKE, { items: [perch.instanceId] }, OP.STASH_RESULT);
check(took?.ok && took.stash.items.length === 0 && took.stash.slotsUsed === 1, 'STASH_TAKE brings the item back');
const expanded = await eOp(OP.STASH_EXPAND, {}, OP.STASH_RESULT);
check(expanded?.ok && expanded.stash.level === 1 && expanded.stash.slotsMax === 120 && expanded.coin === 885, 'STASH_EXPAND buys 120 slots for 2.000 Coin');
check(cat.stash.tiers[0].price === 2000 && cat.stash.tiers[0].slots === expanded.stash.slotsMax, 'get_catalog lists the first stash tier the server sold');
check((await eOp(OP.STASH_EXPAND, {}, OP.STASH_RESULT))?.reason === 'NOT_ENOUGH_COIN', 'the next tier needs 5.000 Coin');
// Everything stays after leaving: rod, stash level and contents.
await e.socket.leaveMatch(target.matchId);
await sleep(300);
await e.join(target.matchId);
await sleep(400);
check(e.take(OP.WELCOME)[0]?.rod?.durability === 199, 'the rod is saved');
const reopened = await eOp(OP.STASH_OPEN, {}, OP.STASH_RESULT);
check(reopened?.ok && reopened.stash.level === 1 && reopened.stash.stacks.some((x) => x.defId === 'lake.junk.shell' && x.count === 3), 'the stash is saved');
e.socket.disconnect(false);

// Friends (Faz 3): Nakama friend requests, friends_status, "Yanına git", emotes.
await client.addFriends(b.session, [c.session.user_id]);
await client.addFriends(c.session, [b.session.user_id]);
const fs = (await client.rpc(b.session, 'friends_status', {})).payload;
const cf = fs.friends.find((f) => f.userId === c.session.user_id);
check(cf?.online && cf.matchId === target.matchId && Math.abs(cf.x - pos.x) < 1e-6, 'friends_status shows the friend online with server and place');
b.clear();
b.send(OP.GOTO_FRIEND, { userId: c.session.user_id });
await sleep(300);
const tp = b.take(OP.TELEPORT)[0];
check(tp && !tp.reason && Math.hypot(tp.x - pos.x, tp.y - pos.y) < 6, 'GOTO_FRIEND lands next to the friend');
a3.clear();
a3.send(OP.GOTO_FRIEND, { userId: c.session.user_id });
await sleep(300);
check(a3.take(OP.TELEPORT)[0]?.reason === 'NOT_FRIEND', 'GOTO_FRIEND to a non-friend is refused');
b.clear();
c.send(OP.EMOTE, { emote: 'show_fish' });
c.send(OP.EMOTE, { emote: 'kiss' });
await sleep(400);
const em = b.take(OP.EMOTE_SHOW);
check(em.length === 1 && em[0].id === c.session.user_id && em[0].emote === 'show_fish' && em[0].defId, 'nearby friend sees show_fish with the last catch, bad emote dropped');
// Status emote: free ones stick, owned-only ones are refused, remove works.
b.clear();
c.clear();
c.send(OP.EMOTE_STATUS, { emote: 'heart' });
await sleep(400);
const st1 = b.take(OP.EMOTE_STATUS_SHOW);
check(st1.length === 1 && st1[0].id === c.session.user_id && st1[0].emote === 'heart' && !st1[0].reason, 'nearby friend sees the status emote');
check(c.take(OP.EMOTE_STATUS_SHOW)[0]?.emote === 'heart', 'the wearer gets it too');
await sleep(1600);
// take() only reads the inbox; clear it so the next steps see only the new answers.
b.clear();
c.clear();
c.send(OP.EMOTE_STATUS, { emote: 'star' });
await sleep(500);
const st2 = c.take(OP.EMOTE_STATUS_SHOW)[0];
const st2b = b.take(OP.EMOTE_STATUS_SHOW);
check(st2?.reason === 'NOT_OWNED' && st2.emote === 'heart' && st2b.length === 0, 'an emote that is not owned is refused and only the sender hears');
if (st2?.reason !== 'NOT_OWNED' || st2b.length > 0) console.log('     sender got:', JSON.stringify(st2), ' friend got:', JSON.stringify(st2b));
await sleep(1600);
b.clear();
c.clear();
c.send(OP.EMOTE_STATUS, { emote: null });
await sleep(500);
const st3 = b.take(OP.EMOTE_STATUS_SHOW);
check(st3[0]?.emote === null, 'removing the status emote is broadcast');
if (st3[0]?.emote !== null) console.log('     friend got:', JSON.stringify(st3), ' sender got:', JSON.stringify(c.take(OP.EMOTE_STATUS_SHOW)));
// "Yanına git" from outside: join with { near } and land beside the friend
await b.socket.leaveMatch(target.matchId);
await sleep(300);
b.clear();
await b.join(target.matchId, { protocolVersion: '1', characterId: 'default', near: c.session.user_id });
await sleep(400);
const wb = b.take(OP.WELCOME)[0];
check(wb && Math.hypot(wb.you.x - pos.x, wb.you.y - pos.y) < 6, 'joining with near lands beside the friend');


// Faz 5-6: level, daily quests, item lock, trade and the pet stall. Two seeded level-10 players.
const LEVEL_10_XP = 13500; // XP.base 250, perLevel 250: sum of 250 + 250 * l for l = 1..9
const f = await player('fikret');
const g = await player('gul');
const seedFor = (who) => (collection, key, value) =>
  consoleApi(`/v2/console/storage/${collection}/${key}/${who.session.user_id}`, 'PUT', { value: JSON.stringify(value), version: '', permission_read: 1, permission_write: 0 }, admin);
const fCarp = { instanceId: `smoke-fcarp-${run}`, defId: 'lake.fish.carp', tier: 'common', float: 0.3, source: 'fishing', obtainedAt: Date.now() };
const fPerch = { instanceId: `smoke-fperch-${run}`, defId: 'lake.fish.perch', tier: 'common', float: 0.4, source: 'fishing', obtainedAt: Date.now() };
for (const who of [f, g]) await seedFor(who)('player', 'xp', { total: LEVEL_10_XP });
await seedFor(f)('items', fCarp.instanceId, fCarp);
await seedFor(f)('items', fPerch.instanceId, fPerch);
await seedFor(f)('bag', 'stacks', { stacks: { 'lake.mat.scale': 5 } });
await consoleApi(`/v2/console/account/${f.session.user_id}`, 'POST', { wallet: JSON.stringify({ coin: 500, diamond: 15 }) }, admin);
await consoleApi(`/v2/console/account/${g.session.user_id}`, 'POST', { wallet: JSON.stringify({ coin: 1000 }) }, admin);
await f.join(target.matchId);
await g.join(target.matchId);
await sleep(500);
const wf = f.take(OP.WELCOME)[0];
check(wf?.level === 10 && wf.xp === 0 && wf.xpNext === 2750, 'WELCOME carries level 10 from stored XP');
const qf = f.take(OP.QUEST_STATE)[0];
check(qf?.quests?.length === 3 && !qf.complete && !qf.claimed && qf.chestDay === 1 && qf.resetInMs > 0, 'QUEST_STATE after WELCOME: three quests for today');
async function opOf(p, op, body, reply, wait = 300) {
  p.clear();
  p.send(op, body);
  await sleep(wait);
  return p.take(reply)[0];
}
check((await opOf(f, OP.QUEST_CLAIM, {}, OP.QUEST_CLAIM_RESULT))?.reason === 'NOT_DONE', 'the chest waits until the quests are done');

// Item lock
const locked = await opOf(f, OP.ITEM_LOCK, { instanceId: fCarp.instanceId, locked: true }, OP.ITEM_LOCK_RESULT);
check(locked?.ok && locked.locked === true, 'ITEM_LOCK locks a bag item');
check((await opOf(f, OP.SELL, { items: [fCarp.instanceId] }, OP.ECONOMY_RESULT))?.reason === 'LOCKED', 'a locked item cannot be sold');

// Trade: both stand at the spawn.
f.clear();
g.clear();
f.send(OP.TRADE_OFFER, { userId: g.session.user_id });
await sleep(300);
check(g.take(OP.TRADE_INVITE)[0]?.from === f.session.user_id, 'TRADE_OFFER reaches the other player as an invite');
g.send(OP.TRADE_REPLY, { accept: true });
await sleep(300);
check(f.take(OP.TRADE_STATE).length > 0 && g.take(OP.TRADE_STATE).length > 0, 'accepting opens the window on both sides');
check((await opOf(f, OP.TRADE_SET, { items: [fCarp.instanceId], stacks: [], coin: 0 }, OP.TRADE_STATE))?.reason === 'LOCKED', 'a locked item cannot be offered');
check((await opOf(f, OP.ITEM_LOCK, { instanceId: fCarp.instanceId, locked: false }, OP.ITEM_LOCK_RESULT))?.locked === false, 'ITEM_LOCK unlocks it again');
await opOf(f, OP.TRADE_SET, { items: [fPerch.instanceId], stacks: [{ defId: 'lake.mat.scale', count: 2 }], coin: 0 }, OP.TRADE_STATE);
await opOf(g, OP.TRADE_SET, { items: [], stacks: [], coin: 100 }, OP.TRADE_STATE);
f.send(OP.TRADE_LOCK, { locked: true });
g.send(OP.TRADE_LOCK, { locked: true });
await sleep(300);
const early = await opOf(f, OP.TRADE_CONFIRM, {}, OP.TRADE_STATE);
check(early && !early.youConfirmed && early.confirmInMs > 0, 'confirming before the countdown ends does nothing');
await sleep(3200);
f.clear();
g.clear();
f.send(OP.TRADE_CONFIRM, {});
g.send(OP.TRADE_CONFIRM, {});
await sleep(500);
const endG = g.take(OP.TRADE_END)[0];
const endF = f.take(OP.TRADE_END)[0];
check(endF?.result === 'done' && endG?.result === 'done', 'both confirm: the trade is done');
check(endG?.got?.items?.[0]?.instanceId === fPerch.instanceId && endG.got.items[0].source === 'trade' && endG.got.stacks[0]?.count === 2 && endF?.got?.coin === 100,
  'TRADE_END says what each side got');
const fAfterTrade = (await client.rpc(f.session, 'get_inventory', {})).payload;
check(fAfterTrade.coin === 600 && !fAfterTrade.items.some((i) => i.instanceId === fPerch.instanceId) && fAfterTrade.stacks.find((x) => x.defId === 'lake.mat.scale')?.count === 3,
  'get_inventory shows the trade: Coin in, fish and scales out');

// Pet stall: both walk north to the market.
async function walkPath(p, from, path) {
  const at = { ...from };
  for (const to of path) {
    while (Math.abs(at.x - to.x) > 1e-6 || Math.abs(at.y - to.y) > 1e-6) {
      const dx = Math.max(-0.35, Math.min(0.35, to.x - at.x));
      const dy = Math.max(-0.35, Math.min(0.35, to.y - at.y));
      at.x += dx;
      at.y += dy;
      p.send(OP.MOVE, { seq: ++p.seq, x: at.x, y: at.y, dir: dy < 0 ? 'up' : 'left', moving: true });
      await sleep(100);
    }
  }
  await sleep(300);
}
check((await opOf(f, OP.STALL_OPEN, { title: 'Smoke', items: [{ instanceId: fCarp.instanceId, price: 50 }] }, OP.STALL_RESULT))?.reason === 'NOT_IN_MARKET',
  'a stall only opens at the market');
const toMarket = [{ x: 60.5, y: wf.you.y }, { x: 60.5, y: 24.5 }];
await Promise.all([walkPath(f, wf.you, toMarket), walkPath(g, wf.you, toMarket)]);
check(f.take(OP.CORRECTION).length === 0 && g.take(OP.CORRECTION).length === 0, 'the walk to the market gets no CORRECTION');
g.clear();
const opened2 = await opOf(f, OP.STALL_OPEN, { title: 'Smoke', items: [{ instanceId: fCarp.instanceId, price: 50 }], stacks: [{ defId: 'lake.mat.scale', count: 2, price: 3 }] }, OP.STALL_RESULT);
check(opened2?.ok && typeof opened2.spot === 'number', 'STALL_OPEN at the market gives a spot');
const seen = g.take(OP.STALL_STATE).flatMap((m) => m.stalls).find((v) => v.userId === f.session.user_id);
check(seen?.title === 'Smoke' && seen.total === 2 && seen.top[0]?.defId === 'lake.fish.carp' && seen.top[0].price === 50, 'everyone sees the stall with its first entries');
check((await opOf(f, OP.STALL_OPEN, { items: [{ instanceId: fPerch.instanceId, price: 1 }] }, OP.STALL_RESULT))?.reason === 'ALREADY_OPEN', 'one stall per player');
const list = await opOf(g, OP.STALL_VIEW, { userId: f.session.user_id }, OP.STALL_LIST);
check(list?.items?.[0]?.item?.instanceId === fCarp.instanceId && list.items[0].item.float === 0.3 && list.stacks[0]?.count === 2, 'STALL_VIEW lists everything with Float');
const stallBought = await opOf(g, OP.STALL_BUY, { userId: f.session.user_id, instanceId: fCarp.instanceId, defId: '', count: 0 }, OP.STALL_RESULT, 500);
check(stallBought?.ok && stallBought.paid === 50 && stallBought.coin === 850 && stallBought.item?.instanceId === fCarp.instanceId && stallBought.item.source === 'trade', 'STALL_BUY buys the fish for 50 Coin');
const boughtStack = await opOf(g, OP.STALL_BUY, { userId: f.session.user_id, instanceId: '', defId: 'lake.mat.scale', count: 1 }, OP.STALL_RESULT, 500);
check(boughtStack?.ok && boughtStack.paid === 3 && boughtStack.coin === 847 && boughtStack.count === 1, 'STALL_BUY takes part of a stack');
check((await opOf(f, OP.STALL_BUY, { userId: f.session.user_id, defId: 'lake.mat.scale', count: 1 }, OP.STALL_RESULT))?.reason === 'OWN_STALL', 'nobody buys from their own stall');
const recalled = await opOf(f, OP.STALL_RECALL, {}, OP.STALL_RESULT, 500);
check(recalled?.ok && recalled.returned?.stacks?.[0]?.defId === 'lake.mat.scale' && recalled.returned.stacks[0].count === 1, 'STALL_RECALL brings the unsold scale back');
const fAfterMarket = (await client.rpc(f.session, 'get_inventory', {})).payload;
check(fAfterMarket.coin === 649 && fAfterMarket.stacks.find((x) => x.defId === 'lake.mat.scale')?.count === 2, 'the seller got the price minus the 5 % fee (47 + 2 Coin)');
// Quitting the game closes the stall and returns what is on it.
check((await opOf(f, OP.STALL_OPEN, { stacks: [{ defId: 'lake.mat.scale', count: 2, price: 9 }] }, OP.STALL_RESULT))?.ok, 'a second stall opens after the recall');
// Market board: a diamond-paid ad, and a click on it takes the viewer next to the stall.
check((await opOf(g, OP.BOARD_AD, { action: 'set', highlights: [] }, OP.BOARD_RESULT))?.reason === 'NO_STALL', 'no ad without a stall');
g.clear();
const adRes = await opOf(f, OP.BOARD_AD, { action: 'set', highlights: [{ instanceId: '', defId: 'lake.mat.scale' }] }, OP.BOARD_RESULT);
check(adRes?.ok && adRes.diamond === 5, 'the board ad costs 10 diamonds (15 -> 5)');
await sleep(300);
const board = g.take(OP.BOARD_STATE).flatMap((m) => m.ads);
check(board.some((a) => a.userId === f.session.user_id && a.top[0]?.defId === 'lake.mat.scale'), 'everyone sees the ad with its picked entry');
check((await opOf(f, OP.BOARD_AD, { action: 'set', highlights: [{ instanceId: 'nope', defId: '' }] }, OP.BOARD_RESULT))?.reason === 'NOT_IN_STALL', 'an ad can only pick entries of its stall');
g.clear();
g.send(OP.BOARD_GOTO, { userId: f.session.user_id });
await sleep(400);
const gt = g.take(OP.TELEPORT)[0];
check(gt && !gt.reason, 'BOARD_GOTO lands next to the advertised stall');
// Whisper (docs/protokol.md, Fısıltı): a level 10 stranger may write from the stall only.
f.notes.length = 0;
check((await rpcError(g, 'whisper_send', { userId: f.session.user_id, username: '', text: 'selam', context: '' })) === 'NOT_ALLOWED', 'a stranger cannot whisper outside the market');
const ws = (await client.rpc(g.session, 'whisper_send', { userId: '', username: f.session.username, text: 'kaça? 0532 123 45 67', context: 'stall' })).payload;
check(ws?.ok && ws.to === f.session.user_id && ws.text === 'kaça? ***' && ws.masked, 'whisper from the stall goes through with the phone masked');
await sleep(400);
const note = f.notes.find((n) => n.code === 110);
const noteBody = note && (typeof note.content === 'string' ? JSON.parse(note.content) : note.content);
check(noteBody?.from === g.session.user_id && noteBody.text === 'kaça? ***' && noteBody.context === 'stall', 'the stall owner gets the whisper as a live notification');
check((await client.rpc(f.session, 'whisper_settings', { pmOff: true })).payload?.pmOff === true, 'whisper_settings turns PM off');
check((await rpcError(g, 'whisper_send', { userId: f.session.user_id, username: '', text: 'yine ben', context: 'stall' })) === 'NOT_ALLOWED', 'PM off stops strangers, stall or not');
check((await client.rpc(f.session, 'report_player', { userId: g.session.user_id, reason: 'spam', note: '', text: 'yine ben' })).payload?.ok, 'report_player stores a report');
// Trade log: the trade and the two stall sales are on record (only the server and the console read it).
const fLogs = await consoleApi(`/v2/console/storage?user_id=${f.session.user_id}&collection=trades`, 'GET', undefined, admin);
// The console list leaves out values; the kind is in the key (<time>_<kind>_<ref>).
const fKinds = (fLogs.objects || []).map((o) => o.key.replace(/^\d+_/, '').replace(/_[0-9a-f-]{36}$/, ''));
check(fKinds.filter((k) => k === 'trade').length === 1 && fKinds.filter((k) => k === 'stall_sale').length === 2, 'the trade and both stall sales are logged for the seller');
if (fKinds.length !== 3) console.log('     log kinds:', JSON.stringify(fKinds));
g.clear();
f.socket.disconnect(false);
await sleep(800);
check(g.take(OP.STALL_STATE).some((m) => m.removed.includes(f.session.user_id)), 'the stall closes when its owner quits the game');
const fAfterQuit = (await client.rpc(f.session, 'get_inventory', {})).payload;
check(fAfterQuit.stacks.find((x) => x.defId === 'lake.mat.scale')?.count === 2, 'what was on it is back in the bag');
g.socket.disconnect(false);

// Friends whisper across the map, and a stranger below level 10 cannot.
const wbc = (await client.rpc(b.session, 'whisper_send', { userId: c.session.user_id, username: '', text: 'göle gel', context: '' })).payload;
check(wbc?.ok && wbc.text === 'göle gel' && !wbc.masked, 'a friend can always whisper');
check((await rpcError(a, 'whisper_send', { userId: c.session.user_id, username: '', text: 'selam', context: 'stall' })) === 'NOT_ALLOWED', 'a stranger without a stall to write to is refused');
check((await rpcError(b, 'whisper_send', { userId: '', username: 'nobody_' + run, text: 'x', context: '' })) === 'NOT_FOUND', 'whisper to an unknown name says NOT_FOUND');
// RPC rate limit: friends_status allows 5 calls in 10 s (config RPC_LIMITS, Öneri).
const limitCodes = [];
for (let i = 0; i < 6; i++) limitCodes.push(await rpcError(a, 'friends_status', {}));
check(limitCodes.slice(0, 5).every((x) => x === '') && limitCodes[5] === 'RATE_LIMITED', 'friends_status called in a loop gets RATE_LIMITED');
for (const p of [a, a2, a3, b, c]) p.socket.disconnect(false);
console.log(failed === 0 ? 'all good' : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

// The reel model from docs/protokol.md, for the test bot only (server/src/rules/reel.ts is the rule).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
function reelRun(seed, p, decide) {
  const rng = mulberry32(seed);
  let bar = Math.floor((1000 - p.barSize) / 2), vel = 0, fish = 500, target = 500, left = 0, progress = 300, pressed = false;
  for (let k = 1; k <= p.maxSteps; k++) {
    pressed = decide(k, pressed, bar, vel, fish);
    vel = Math.max(-p.maxVel, Math.min(p.maxVel, vel + (pressed ? p.lift : -p.gravity)));
    bar += vel;
    if (bar < 0) [bar, vel] = [0, 0];
    if (bar > 1000 - p.barSize) [bar, vel] = [1000 - p.barSize, 0];
    if (left === 0) [target, left] = [rng() % 1001, p.retargetSteps];
    else left--;
    fish = fish < target ? Math.min(target, fish + p.fishSpeed) : Math.max(target, fish - p.fishSpeed);
    progress += fish >= bar && fish <= bar + p.barSize ? p.gain : -p.loss;
    if (progress >= 1000 || progress <= 0) return k;
  }
  return p.maxSteps;
}
function bot(seed, p) {
  const inputs = [];
  reelRun(seed, p, (k, pressed, bar, vel, fish) => {
    const want = bar + p.barSize / 2 + vel * 8 < fish;
    if (want !== pressed) inputs.push(k * 20);
    return want;
  });
  return inputs;
}
function simulate(seed, p, inputs) {
  let next = 0;
  return reelRun(seed, p, (k, pressed) => {
    while (next < inputs.length && inputs[next] <= k * 20) [pressed, next] = [!pressed, next + 1];
    return pressed;
  });
}
