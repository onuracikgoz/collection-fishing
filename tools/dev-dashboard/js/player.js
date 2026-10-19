// A test player the dashboard controls: its own device account, socket and a
// small world model built only from server messages, like the Unity client.
import { Socket } from './nakama.js';

export const OP = {
  MOVE: 1, SNAPSHOT: 2, PLAYER_ENTER: 3, PLAYER_LEAVE: 4, SAY: 5, BUBBLE: 6, CORRECTION: 7, WELCOME: 8,
  CAST: 9, BOBBER: 10, HOOK: 11, REEL_START: 12, REEL_DONE: 13, FISH_END: 14, CANCEL: 15, BOOK_PLACE: 16, BOOK_RESULT: 17,
  GOTO_FRIEND: 18, TELEPORT: 19, EMOTE: 20, EMOTE_SHOW: 21, SELL: 22, SALVAGE: 23, ECONOMY_RESULT: 24, MERGE: 25, CRAFT: 26, CRAFT_RESULT: 27,
};

export function opName(op, opCodes = OP) {
  for (const k in opCodes) if (opCodes[k] === op) return k;
  return `OP_${op}`;
}

const STEP_TILES = 0.38; // per 100 ms: 3.8 tiles/s, under the 4 × 1.2 limit
const MAX_LOG = 1500;

export class Player {
  constructor(app, { deviceId, username }) {
    this.app = app;
    this.deviceId = deviceId;
    this.wantedName = username;
    this.session = null;
    this.socket = null;
    this.matchId = null;
    this.serverName = null;
    this.seq = 0;
    this.me = null; // { x, y, dir }
    this.energy = null;
    this.energyMax = null;
    this.others = new Map(); // id -> { id, name, x, y, dir, moving, characterId }
    this.bobbers = new Map(); // id -> { x, y, band, state }
    this.bubbles = []; // { id, text, at }
    this.emotes = []; // { id, emote, defId, at }
    this.fishing = null; // own: { state, band, x, y, reel? }
    this.log = [];
    this.last = {}; // op name -> last body
    this.listeners = new Set();
    this.auto = { hook: true, reel: 'win', loop: false, skipWait: false, band: 'deep' };
    this.walkTimer = null;
    this.path = [];
    this.castTarget = null;
    this.onReelStart = null; // set by the manual reel widget
  }

  get label() {
    return this.session ? this.session.username : this.wantedName;
  }

  get userId() {
    return this.session ? this.session.userId : null;
  }

  get online() {
    return !!(this.socket && this.socket.open && this.matchId);
  }

  changed() {
    for (const l of this.listeners) l(this);
  }

  addLog(entry) {
    entry.t = Date.now();
    entry.player = this.label;
    this.log.push(entry);
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
    this.app.onLog(this, entry);
  }

  async login() {
    this.session = await this.app.conn.authenticateDevice(this.deviceId, this.wantedName);
    this.changed();
    return this.session;
  }

  async connect() {
    if (!this.session) await this.login();
    if (this.socket && this.socket.open) return;
    this.socket = new Socket(this.session);
    this.socket.onMatchData = (m) => this.receive(m);
    this.socket.onClose = () => {
      this.addLog({ dir: 'sys', name: 'socket kapandı' });
      this.matchId = null;
      this.stopWalk();
      this.changed();
    };
    await this.socket.connect();
    this.addLog({ dir: 'sys', name: 'socket açıldı' });
  }

  async join(matchId, metadata = { protocolVersion: '1', characterId: 'default' }) {
    await this.connect();
    if (this.matchId) await this.leave();
    this.others.clear();
    this.bobbers.clear();
    this.fishing = null;
    this.addLog({ dir: 'out', name: 'joinMatch', body: { matchId, metadata } });
    try {
      await this.socket.joinMatch(matchId, metadata);
    } catch (e) {
      this.addLog({ dir: 'err', name: 'joinMatch reddedildi', body: e.body || e.message });
      throw e;
    }
    this.matchId = matchId;
    this.changed();
  }

  async leave() {
    if (!this.matchId) return;
    const id = this.matchId;
    this.stopWalk();
    this.matchId = null;
    try {
      await this.socket.leaveMatch(id);
    } catch (_e) {
      // already gone
    }
    this.addLog({ dir: 'sys', name: 'maçtan çıktı' });
    this.me = null;
    this.changed();
  }

  disconnect() {
    this.stopWalk();
    if (this.socket) this.socket.close();
    this.socket = null;
    this.matchId = null;
    this.changed();
  }

  send(op, body) {
    if (!this.online) throw new Error(`${this.label}: önce bir sunucuya gir`);
    this.socket.sendMatch(this.matchId, op, body);
    let parsed = body;
    if (typeof body === 'string') {
      try {
        parsed = JSON.parse(body);
      } catch (_e) {
        // raw text
      }
    }
    if (op !== OP.MOVE || this.app.logMoves) this.addLog({ dir: 'out', op, name: opName(op, this.app.opCodes), body: parsed });
  }

  receive({ op, body }) {
    const name = opName(op, this.app.opCodes);
    this.last[name] = body;
    const quiet = op === OP.SNAPSHOT && !this.app.logSnapshots;
    if (!quiet) this.addLog({ dir: 'in', op, name, body });
    const mine = body && body.id === this.userId;
    switch (op) {
      case OP.WELCOME:
        this.me = { x: body.you.x, y: body.you.y, dir: 'down' };
        this.serverName = body.serverName;
        this.energy = body.energy;
        this.energyMax = body.energyMax;
        break;
      case OP.SNAPSHOT:
        for (const p of body.players || []) Object.assign(this.others.get(p.id) || this.others.set(p.id, { id: p.id }).get(p.id), p);
        break;
      case OP.PLAYER_ENTER:
        this.others.set(body.id, { ...body });
        if (body.bobber) this.bobbers.set(body.id, { ...body.bobber, state: 'cast' });
        break;
      case OP.PLAYER_LEAVE:
        this.others.delete(body.id);
        this.bobbers.delete(body.id);
        break;
      case OP.BUBBLE:
        this.bubbles.push({ id: body.id, text: body.text, at: Date.now() });
        if (this.bubbles.length > 30) this.bubbles.shift();
        break;
      case OP.CORRECTION:
        if (this.me) Object.assign(this.me, { x: body.x, y: body.y });
        this.stopWalk();
        break;
      case OP.TELEPORT:
        if (!body.reason && this.me) Object.assign(this.me, { x: body.x, y: body.y });
        this.stopWalk();
        break;
      case OP.BOBBER:
        this.bobbers.set(body.id, { x: body.x, y: body.y, band: body.band, state: body.state });
        if (mine) this.onOwnBobber(body);
        break;
      case OP.REEL_START:
        this.onOwnReel(body);
        break;
      case OP.FISH_END:
        this.bobbers.delete(body.id);
        if (mine) this.onOwnFishEnd(body);
        break;
      case OP.EMOTE_SHOW:
        this.emotes.push({ ...body, at: Date.now() });
        if (this.emotes.length > 20) this.emotes.shift();
        break;
    }
    this.changed();
  }

  // --- movement ---

  /** Walks to a tile along a path over walkable tiles, sending MOVE at 10 Hz. */
  walkTo(tx, ty) {
    if (!this.me) throw new Error('önce bir sunucuya gir');
    const path = this.app.grid.path(this.me.x, this.me.y, tx, ty);
    if (!path) throw new Error('oraya yol yok');
    this.path = path;
    this.startWalk();
    return path.length;
  }

  startWalk() {
    if (this.walkTimer) return;
    this.walkTimer = setInterval(() => this.walkStep(), 100);
  }

  stopWalk() {
    if (this.walkTimer) {
      clearInterval(this.walkTimer);
      this.walkTimer = null;
      if (this.online && this.me) this.send(OP.MOVE, { seq: ++this.seq, x: this.me.x, y: this.me.y, dir: this.me.dir, moving: false });
    }
    this.path = [];
  }

  walkStep() {
    if (!this.online || !this.me) return this.stopWalk();
    let budget = STEP_TILES;
    let { x, y } = this.me;
    let dir = this.me.dir;
    while (budget > 0 && this.path.length > 0) {
      const [nx, ny] = this.path[0];
      const dx = nx - x;
      const dy = ny - y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
      else if (d > 0) dir = dy > 0 ? 'down' : 'up';
      if (d <= budget) {
        x = nx;
        y = ny;
        budget -= d;
        this.path.shift();
      } else {
        x += (dx / d) * budget;
        y += (dy / d) * budget;
        budget = 0;
      }
    }
    x = Math.round(x * 1000) / 1000;
    y = Math.round(y * 1000) / 1000;
    Object.assign(this.me, { x, y, dir });
    const done = this.path.length === 0;
    this.send(OP.MOVE, { seq: ++this.seq, x, y, dir, moving: !done });
    if (done) {
      clearInterval(this.walkTimer);
      this.walkTimer = null;
      this.onArrive && this.onArrive();
      this.onArrive = null;
    }
    this.changed();
  }

  // --- fishing helpers ---

  cast(x, y) {
    this.castTarget = { x, y };
    this.send(OP.CAST, { x, y });
  }

  /** Walks to the nearest shore spot that reaches water of `band`, then casts. */
  goFish(band = this.auto.band) {
    if (!this.me) throw new Error('önce bir sunucuya gir');
    const plan = this.app.grid.fishingSpot(this.me.x, this.me.y, band, this.app.info.config.FISHING);
    if (!plan) throw new Error(`${band} bandına ulaşan kıyı bulunamadı`);
    this.path = plan.path;
    this.onArrive = () => setTimeout(() => this.online && this.cast(plan.target.x, plan.target.y), 150);
    if (plan.path.length === 0) {
      this.onArrive();
      this.onArrive = null;
    } else this.startWalk();
    return plan;
  }

  onOwnBobber(b) {
    this.fishing = { ...(this.fishing || {}), state: b.state, band: b.band, x: b.x, y: b.y };
    if (b.energy !== undefined) this.energy = b.energy;
    if (b.state === 'cast' && this.auto.skipWait) {
      this.app.admin.rpc('dev_live', { userId: this.userId, action: 'bite_now' }).catch(() => {});
    }
    if (b.state === 'bite' && this.auto.hook) setTimeout(() => this.online && this.send(OP.HOOK, {}), 120);
  }

  async onOwnReel(msg) {
    this.fishing = { ...(this.fishing || {}), state: 'reeling', reel: msg };
    if (this.auto.reel === 'manual') {
      if (this.onReelStart) this.onReelStart(this, msg);
      return;
    }
    const lose = this.auto.reel === 'lose';
    try {
      const sol = await this.app.admin.rpc('dev_reel', { seed: msg.seed, params: msg.params, lose });
      const wait = sol.minMs + 80;
      this.addLog({ dir: 'sys', name: `otomatik çekme: ${sol.caught ? 'yakalar' : 'kaçırır'}, ${wait} ms bekliyor` });
      setTimeout(() => this.online && this.send(OP.REEL_DONE, { inputs: sol.inputs }), wait);
    } catch (e) {
      this.addLog({ dir: 'err', name: 'dev_reel başarısız', body: e.message });
    }
  }

  onOwnFishEnd(end) {
    this.fishing = null;
    if (end.energy !== undefined) this.energy = end.energy;
    if (!this.auto.loop) return;
    if (end.outcome === 'rejected' && end.reason !== 'BUSY') {
      this.auto.loop = false;
      this.addLog({ dir: 'sys', name: `döngü durdu: ${end.reason}` });
      return;
    }
    if (end.outcome === 'cancelled') return;
    setTimeout(() => {
      if (!this.auto.loop || !this.online || this.fishing) return;
      if (this.castTarget) this.cast(this.castTarget.x, this.castTarget.y);
    }, 400);
  }
}

/** Walkable grid from dev_info's map rows, for paths and fishing spots. */
export class Grid {
  constructor(map) {
    this.w = map.width;
    this.h = map.height;
    this.rows = map.rows;
    this.spawn = map.spawn;
  }

  at(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '#';
    return this.rows[y][x];
  }

  walkable(x, y) {
    return this.at(x, y) === '.';
  }

  /** Breadth-first distances from (sx, sy) over walkable tiles (4 neighbours). */
  bfs(sx, sy) {
    const dist = new Int32Array(this.w * this.h).fill(-1);
    const prev = new Int32Array(this.w * this.h).fill(-1);
    const start = sy * this.w + sx;
    if (!this.walkable(sx, sy)) return { dist, prev };
    dist[start] = 0;
    const q = [start];
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      const cx = c % this.w;
      const cy = (c - cx) / this.w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.walkable(nx, ny)) continue;
        const n = ny * this.w + nx;
        if (dist[n] >= 0) continue;
        dist[n] = dist[c] + 1;
        prev[n] = c;
        q.push(n);
      }
    }
    return { dist, prev };
  }

  trace(prev, goal) {
    const out = [];
    for (let c = goal; c >= 0; c = prev[c]) {
      const x = c % this.w;
      out.unshift([x + 0.5, (c - x) / this.w + 0.5]);
    }
    out.shift(); // the start tile; we walk from the exact position
    return out;
  }

  path(fx, fy, tx, ty) {
    const sx = Math.floor(fx);
    const sy = Math.floor(fy);
    const gx = Math.floor(tx);
    const gy = Math.floor(ty);
    if (!this.walkable(gx, gy)) return null;
    const { dist, prev } = this.bfs(sx, sy);
    const goal = gy * this.w + gx;
    if (dist[goal] < 0) return null;
    const p = this.trace(prev, goal);
    // End on the clicked point, not just the tile centre.
    if (p.length > 0) p[p.length - 1] = [tx, ty];
    else p.push([tx, ty]);
    return p;
  }

  bandAt(x, y) {
    const c = this.at(x, y);
    return c === 's' ? 'shore' : c === 'm' ? 'mid' : c === 'd' ? 'deep' : null;
  }

  /** Nearest walkable tile next to water that can cast into `band`, and a target in it. */
  fishingSpot(fx, fy, band, fishing) {
    const { dist, prev } = this.bfs(Math.floor(fx), Math.floor(fy));
    const reach = fishing.maxCast - 0.6;
    const water = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.bandAt(x, y) === band) water.push([x + 0.5, y + 0.5]);
    let best = null;
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] < 0 || (best && dist[i] >= best.d)) continue;
      const x = i % this.w;
      const y = (i - x) / this.w;
      let nearWater = false;
      for (let dy = -1; dy <= 1 && !nearWater; dy++) for (let dx = -1; dx <= 1 && !nearWater; dx++) if (this.bandAt(x + dx, y + dy)) nearWater = true;
      if (!nearWater) continue;
      const sx = x + 0.5;
      const sy = y + 0.5;
      let target = null;
      let td = Infinity;
      for (const [wx, wy] of water) {
        const d = Math.hypot(wx - sx, wy - sy);
        if (d <= reach && d < td) {
          td = d;
          target = { x: wx, y: wy };
        }
      }
      if (target) best = { d: dist[i], goal: i, target, stand: { x: sx, y: sy } };
    }
    if (!best) return null;
    return { path: best.d === 0 ? [] : this.trace(prev, best.goal), target: best.target, stand: best.stand };
  }
}
