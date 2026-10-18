// End-to-end check against a running local Nakama (docker compose up -d).
// Two fake players log in, walk, cheat, chat and leave. Run: npm run smoke
import { Client } from '@heroiclabs/nakama-js';

const OP = { MOVE: 1, SNAPSHOT: 2, PLAYER_ENTER: 3, PLAYER_LEAVE: 4, SAY: 5, BUBBLE: 6, CORRECTION: 7, WELCOME: 8 };
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

for (const p of [a, a2, a3, b]) p.socket.disconnect(false);
console.log(failed === 0 ? 'all good' : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
