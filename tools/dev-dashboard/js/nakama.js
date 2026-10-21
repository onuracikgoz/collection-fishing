// Minimal Nakama client for the dev dashboard: device login, RPC and the match
// WebSocket in JSON format. No dependencies, so the page works offline.

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(str) {
  const bytes = enc.encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  if (!b64) return '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

export class NakamaError extends Error {
  constructor(status, body) {
    let msg = (body && (body.message || body.error)) || `HTTP ${status}`;
    // Our RPCs put { code, message } JSON in the message.
    let code = body && body.code;
    try {
      const inner = JSON.parse(msg);
      if (inner && inner.code) {
        code = inner.code;
        msg = `${inner.code}: ${inner.message}`;
      }
    } catch (_e) {
      // plain text
    }
    super(msg);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class Conn {
  constructor({ host = '127.0.0.1', port = '7350', ssl = false, serverKey = 'defaultkey' } = {}) {
    this.host = host;
    this.port = port;
    this.ssl = ssl;
    this.serverKey = serverKey;
  }

  get base() {
    return `${this.ssl ? 'https' : 'http'}://${this.host}:${this.port}`;
  }

  async request(method, path, { body, token, basic } = {}) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (basic) headers.Authorization = `Basic ${btoa(basic + ':')}`;
    const res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (_e) {
      json = { message: text };
    }
    if (!res.ok) throw new NakamaError(res.status, json);
    return json;
  }

  async healthcheck() {
    const res = await fetch(this.base + '/healthcheck');
    return res.ok;
  }

  /** Logs in (or creates) a device account. The username only counts when the account is new. */
  async authenticateDevice(deviceId, username) {
    const q = new URLSearchParams({ create: 'true' });
    if (username) q.set('username', username);
    const s = await this.request('POST', `/v2/account/authenticate/device?${q}`, { body: { id: deviceId }, basic: this.serverKey });
    return new Session(this, s.token, s.refresh_token, !!s.created);
  }
}

function decodeJwt(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(fromBase64(part + '==='.slice((part.length + 3) % 4)));
}

export class Session {
  constructor(conn, token, refreshToken, created) {
    this.conn = conn;
    this.token = token;
    this.refreshToken = refreshToken;
    this.created = created;
    const claims = decodeJwt(token);
    this.userId = claims.uid;
    this.username = claims.usn;
    this.expiresAt = claims.exp * 1000;
  }

  /** Calls an RPC with a JSON payload; returns the parsed reply. */
  async rpc(id, payload = {}) {
    const res = await this.conn.request('POST', `/v2/rpc/${encodeURIComponent(id)}`, {
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
      token: this.token,
    });
    if (!res.payload) return {};
    try {
      return JSON.parse(res.payload);
    } catch (_e) {
      return res.payload;
    }
  }

  account() {
    return this.conn.request('GET', '/v2/account', { token: this.token });
  }

  addFriends(ids = [], usernames = []) {
    const q = new URLSearchParams();
    for (const id of ids) q.append('ids', id);
    for (const u of usernames) q.append('usernames', u);
    return this.conn.request('POST', `/v2/friend?${q}`, { token: this.token });
  }

  deleteFriends(ids = []) {
    const q = new URLSearchParams();
    for (const id of ids) q.append('ids', id);
    return this.conn.request('DELETE', `/v2/friend?${q}`, { token: this.token });
  }

  blockFriends(ids = []) {
    const q = new URLSearchParams();
    for (const id of ids) q.append('ids', id);
    return this.conn.request('POST', `/v2/friend/block?${q}`, { token: this.token });
  }

  listFriends() {
    return this.conn.request('GET', '/v2/friend?limit=100', { token: this.token });
  }
}

/** The realtime socket. `onMatchData({ op, body, raw, presence })`, `onClose()`. */
export class Socket {
  constructor(session) {
    this.session = session;
    this.cid = 0;
    this.waiting = new Map();
    this.onMatchData = () => {};
    this.onClose = () => {};
    this.onOther = () => {};
  }

  connect() {
    const c = this.session.conn;
    const url = `${c.ssl ? 'wss' : 'ws'}://${c.host}:${c.port}/ws?lang=en&status=true&format=json&token=${encodeURIComponent(this.session.token)}`;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve(this);
      ws.onerror = () => reject(new Error('WebSocket error'));
      ws.onclose = (e) => {
        for (const [, w] of this.waiting) w.reject(new Error('socket closed'));
        this.waiting.clear();
        this.onClose(e);
      };
      ws.onmessage = (e) => this.handle(JSON.parse(e.data));
    });
  }

  get open() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  handle(msg) {
    if (msg.cid && this.waiting.has(msg.cid)) {
      const w = this.waiting.get(msg.cid);
      this.waiting.delete(msg.cid);
      if (msg.error) w.reject(new NakamaError(msg.error.code, msg.error));
      else w.resolve(msg);
      return;
    }
    if (msg.match_data) {
      const md = msg.match_data;
      const raw = fromBase64(md.data);
      let body = raw;
      try {
        body = JSON.parse(raw);
      } catch (_e) {
        // not JSON, keep the text
      }
      this.onMatchData({ op: Number(md.op_code), body, raw, presence: md.presence, matchId: md.match_id });
      return;
    }
    this.onOther(msg);
  }

  send(envelope) {
    const cid = String(++this.cid);
    return new Promise((resolve, reject) => {
      this.waiting.set(cid, { resolve, reject });
      this.ws.send(JSON.stringify({ cid, ...envelope }));
    });
  }

  async joinMatch(matchId, metadata) {
    const res = await this.send({ match_join: { match_id: matchId, metadata } });
    return res.match;
  }

  leaveMatch(matchId) {
    return this.send({ match_leave: { match_id: matchId } });
  }

  /** Sends match data. `body` is sent as JSON unless it is already a string. */
  sendMatch(matchId, op, body) {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    this.ws.send(JSON.stringify({ match_data_send: { match_id: matchId, op_code: op, data: toBase64(data), reliable: true } }));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}
