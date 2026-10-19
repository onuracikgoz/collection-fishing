// End-to-end check against a running local Nakama (docker compose up -d).
// Two fake players log in, walk, cheat, chat and leave. Run: npm run smoke
import { Client } from '@heroiclabs/nakama-js';

const OP = {
  MOVE: 1, SNAPSHOT: 2, PLAYER_ENTER: 3, PLAYER_LEAVE: 4, SAY: 5, BUBBLE: 6, CORRECTION: 7, WELCOME: 8,
  CAST: 9, BOBBER: 10, HOOK: 11, REEL_START: 12, REEL_DONE: 13, FISH_END: 14, CANCEL: 15, BOOK_PLACE: 16, BOOK_RESULT: 17,
  GOTO_FRIEND: 18, TELEPORT: 19, EMOTE: 20, EMOTE_SHOW: 21, SELL: 22, SALVAGE: 23, ECONOMY_RESULT: 24, MERGE: 25, CRAFT: 26, CRAFT_RESULT: 27,
};
const client = new Client('defaultkey', process.env.NAKAMA_HOST || '127.0.0.1', '7350', false);
const run = Date.now().toString(36);
let failed = 0;

function check(ok, what) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function player(name, deviceId = `smoke-${name}-${run}`) {
  const session = await client.authenticateDevice(deviceId, true, `${name}_${run}`.slice(0, 16));
  const socket = client.createSocket(false, false);
  const inbox = [];
  socket.onmatchdata = (m) => inbox.push({ op: m.op_code, body: JSON.parse(new TextDecoder().decode(m.data)) });
  await socket.connect(session, true);
  const p = { session, socket, inbox, seq: 0 };
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
async function catchOne(p) {
  p.clear();
  p.hooked = false;
  p.send(OP.CAST, { x: 88.5, y: 47.5 });
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
const salvaged = await economy(OP.SALVAGE, lines[0]);
check(salvaged?.ok && salvaged.dust === salvaged.gained && salvaged.gained > 0 && salvaged.coin === 0, 'SALVAGE turns a bag line into dust');
const rest = lines.slice(1);
const sold = rest.length === 0 ? null : await economy(OP.SELL, {
  items: rest.flatMap((l) => l.items || []),
  stacks: rest.flatMap((l) => l.stacks || []),
});
check(!sold || (sold.ok && sold.coin === sold.gained && sold.gained > 0 && sold.dust === salvaged.dust), 'SELL turns the rest into Coin');
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
check(merged?.ok && merged.item.defId === 'lake.fish.carp' && merged.item.source === 'merge' && merged.item.float <= 0.6 && merged.dust === 15 && merged.items.length === 3,
  'MERGE turns three carps and 10 dust into one carp no worse than the worst');
check((await craftOp(OP.CRAFT, { recipeId: 'recipe.moss_wreath' }))?.reason === 'MISSING_INPUTS', 'CRAFT without the materials is refused');
check((await craftOp(OP.CRAFT, { recipeId: 'recipe.pike_trophy' }))?.reason === 'NO_RECIPE', 'CRAFT without the recipe is refused');
check((await craftOp(OP.CRAFT, { recipeId: 'recipe.scale_charm' }))?.reason === 'NOT_ENOUGH_DUST', 'CRAFT without enough dust is refused');
await consoleApi(`/v2/console/account/${uid}`, 'POST', { wallet: JSON.stringify({ dust: 40 }) }, admin);
const crafted = await craftOp(OP.CRAFT, { recipeId: 'recipe.scale_charm' });
check(crafted?.ok && crafted.item.defId === 'craft.scale_charm' && crafted.item.source === 'craft' && crafted.dust === 20 && crafted.book?.kind === 'discovered' && crafted.book.page === 'crafts',
  'CRAFT spends recipe, materials and dust, and the first crafted item goes to its book slot');
const dInv = (await client.rpc(d.session, 'get_inventory', {})).payload;
const st = Object.fromEntries(dInv.stacks.map((x) => [x.defId, x.count]));
check(!st['recipe.scale_charm'] && st['lake.mat.scale'] === 2 && !st['lake.mat.moss'] && dInv.dust === 20 &&
  dInv.items.some((i) => i.instanceId === carp(4, 0).instanceId) && !dInv.items.some((i) => ids.includes(i.instanceId)),
  'get_inventory shows what merge and craft used up');
await d.socket.leaveMatch(target.matchId);

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
// "Yanına git" from outside: join with { near } and land beside the friend
await b.socket.leaveMatch(target.matchId);
await sleep(300);
b.clear();
await b.join(target.matchId, { protocolVersion: '1', characterId: 'default', near: c.session.user_id });
await sleep(400);
const wb = b.take(OP.WELCOME)[0];
check(wb && Math.hypot(wb.you.x - pos.x, wb.you.y - pos.y) < 6, 'joining with near lands beside the friend');

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
