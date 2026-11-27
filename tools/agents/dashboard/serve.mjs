// Agent dashboard: http://127.0.0.1:7380 (local only by default). No dependencies.
// Reads the JSON that the hooks and statusline write under ~/.cg-agents and sends
// prompts to agents through tmux.
//   node tools/agents/dashboard/serve.mjs
//   PORT=7380  HOST=127.0.0.1  CG_DASH_TOKEN=...   (a token is required when HOST is not loopback, e.g. Tailscale)
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { AGENTS_DIR, TESTS_DIR, readJson } from '../lib/state.mjs';

const run = promisify(execFile);
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 7380);
const host = process.env.HOST || '127.0.0.1';
const token = process.env.CG_DASH_TOKEN || '';
const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
if (!loopback && !token) {
  console.error('HOST yerel değil. Dışarıya açmak için CG_DASH_TOKEN=<uzun-rastgele-metin> ver.');
  process.exit(1);
}

const tmux = (...args) => run('tmux', args, { timeout: 5000 });

async function livePanes() {
  try {
    const { stdout } = await tmux('list-panes', '-a', '-F', '#{pane_id}\t#{pane_current_command}\t#{session_name}:#{window_index}.#{pane_index}');
    const map = new Map();
    for (const line of stdout.trim().split('\n')) {
      const [id, cmd, target] = line.split('\t');
      if (id) map.set(id, { cmd, target });
    }
    return map;
  } catch {
    return new Map();
  }
}

const branchCache = new Map();
async function branchOf(cwd) {
  if (!cwd) return null;
  const hit = branchCache.get(cwd);
  if (hit && Date.now() - hit.at < 5000) return hit.value;
  let value = null;
  try {
    const { stdout } = await run('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 3000 });
    value = stdout.trim();
    if (value === 'HEAD') value = `(detached ${(await run('git', ['-C', cwd, 'rev-parse', '--short', 'HEAD'])).stdout.trim()})`;
  } catch {}
  branchCache.set(cwd, { at: Date.now(), value });
  return value;
}

async function tailEvents(dir, n = 30) {
  try {
    const text = await readFile(join(dir, 'events.jsonl'), 'utf8');
    return text.trim().split('\n').slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}

async function costs(dir) {
  const today = new Date().toISOString().slice(0, 10);
  let total = 0, day = 0, sessions = 0;
  try {
    for (const f of await readdir(join(dir, 'sessions'))) {
      const s = readJson(join(dir, 'sessions', f));
      if (!s) continue;
      sessions++;
      total += s.usd || 0;
      if (s.day === today) day += s.usd || 0;
    }
  } catch {}
  return { total, today: day, sessions };
}

async function collect() {
  const panes = await livePanes();
  let names = [];
  try { names = await readdir(AGENTS_DIR); } catch {}
  const agents = [];
  for (const name of names) {
    const dir = join(AGENTS_DIR, name);
    if (!(await stat(dir).catch(() => null))?.isDirectory()) continue;
    const hook = readJson(join(dir, 'hook.json'), {});
    const status = readJson(join(dir, 'status.json'), {});
    const pane = hook.pane ? panes.get(hook.pane) : null;
    let state = hook.status || 'unknown';
    if (state !== 'ended' && hook.pane && !pane) state = 'offline';
    else if (pane && /^-?(zsh|bash|sh|fish)$/.test(pane.cmd || '')) state = 'ended'; // pane is back at a shell prompt
    agents.push({
      name,
      role: hook.role,
      state,
      activity: hook.activity,
      lastPrompt: hook.lastPrompt,
      lastPromptAt: hook.lastPromptAt,
      lastMessage: hook.lastMessage,
      cwd: hook.cwd,
      branch: await branchOf(hook.cwd),
      pane: hook.pane,
      paneTarget: pane?.target || null,
      canSend: Boolean(pane),
      updatedAt: [hook.updatedAt, status.updatedAt].filter(Boolean).sort().pop() || null,
      model: status.model,
      context: status.context || null,
      cost: { session: status.cost?.usd ?? null, linesAdded: status.cost?.linesAdded, linesRemoved: status.cost?.linesRemoved, ...(await costs(dir)) },
      rateLimits: status.rateLimits || null,
      events: await tailEvents(dir),
    });
  }
  const order = { working: 0, waiting: 1, idle: 2, unknown: 3, offline: 4, ended: 5 };
  agents.sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9) || a.name.localeCompare(b.name));

  let tests = [];
  try {
    const files = (await readdir(TESTS_DIR)).filter((f) => f.endsWith('.json')).sort().slice(-15).reverse();
    tests = files.map((f) => readJson(join(TESTS_DIR, f))).filter(Boolean);
  } catch {}
  const rateLimits = agents.map((a) => a.rateLimits).find(Boolean) || null;
  return { now: new Date().toISOString(), agents, tests, rateLimits };
}

async function findAgent(name) {
  if (!/^[A-Za-z0-9_.-]+$/.test(name || '')) return null;
  const hook = readJson(join(AGENTS_DIR, name, 'hook.json'));
  if (!hook?.pane) return null;
  const panes = await livePanes();
  return panes.has(hook.pane) ? hook : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendPrompt(pane, text) {
  // Bracketed paste keeps multi-line prompts in one message; Enter then submits it.
  const buffer = `cgdash-${process.pid}`;
  await tmux('set-buffer', '-b', buffer, '--', text);
  await tmux('paste-buffer', '-p', '-d', '-b', buffer, '-t', pane);
  await sleep(250);
  await tmux('send-keys', '-t', pane, 'Enter');
}

const KEYS = { escape: 'Escape', enter: 'Enter', 'ctrl-c': 'C-c', 'shift-tab': 'BTab', up: 'Up', down: 'Down', '1': '1', '2': '2', '3': '3' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 200_000) reject(new Error('too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
  });
}

function authorized(req, url) {
  // Block other websites (CSRF / DNS rebinding): require our own header and a matching Host.
  const hostHeader = String(req.headers.host || '').replace(/:\d+$/, '');
  if (loopback && !['127.0.0.1', 'localhost', '[::1]'].includes(hostHeader)) return false;
  if (token) {
    const given = req.headers['x-cg-token'] || url.searchParams.get('token') || (String(req.headers.cookie || '').match(/cgdash=([^;]+)/) || [])[1];
    if (given !== token) return false;
  }
  return true;
}

const json = (res, code, body) => res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!authorized(req, url)) return json(res, 403, { error: 'forbidden' });
  const cookie = token ? { 'Set-Cookie': `cgdash=${token}; HttpOnly; SameSite=Strict; Path=/` } : {};
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const body = await readFile(join(root, 'index.html'));
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...cookie }).end(body);
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, await collect());
    if (req.method === 'GET' && url.pathname === '/api/pane') {
      const agent = await findAgent(url.searchParams.get('agent'));
      if (!agent) return json(res, 404, { error: 'Ajan bir tmux panelinde çalışmıyor' });
      const { stdout } = await tmux('capture-pane', '-p', '-J', '-t', agent.pane, '-S', '-60');
      return json(res, 200, { text: stdout.replace(/\s+$/, '') });
    }
    if (req.method === 'POST') {
      if (req.headers['x-cg-dash'] !== '1') return json(res, 403, { error: 'missing header' });
      const body = await readBody(req);
      if (url.pathname === '/api/send') {
        const agent = await findAgent(body.agent);
        const text = String(body.text || '').trim();
        if (!agent) return json(res, 404, { error: 'Ajan bir tmux panelinde çalışmıyor' });
        if (!text) return json(res, 400, { error: 'Boş prompt' });
        await sendPrompt(agent.pane, text);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/key') {
        const agent = await findAgent(body.agent);
        const key = KEYS[body.key];
        if (!agent || !key) return json(res, 400, { error: 'Ajan ya da tuş geçersiz' });
        await tmux('send-keys', '-t', agent.pane, key);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/forget') {
        const name = String(body.agent || '');
        if (!/^[A-Za-z0-9_.-]+$/.test(name)) return json(res, 400, { error: 'bad name' });
        await rm(join(AGENTS_DIR, name), { recursive: true, force: true });
        return json(res, 200, { ok: true });
      }
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}).listen(port, host, () => console.log(`Ajan dashboard'u: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}${token ? '/?token=…' : ''}`));
