// Bot and multi-account signals (docs/tasarim/03-balik-tutma.md 5.1.1).
// The server only collects numbers and raises flags; nothing here bans anyone.
// A person looks at the flags (dev dashboard "Şüpheliler", later the admin panel)
// and decides. Thresholds live in config.ts (WATCH).

export type FlagKind =
  | 'hook_regular'
  | 'hook_fast'
  | 'reel_perfect'
  | 'nonstop'
  | 'silent'
  | 'same_spot'
  | 'one_way_flow'
  | 'ip_accounts'
  | 'ip_online';

export interface Flag {
  kind: FlagKind;
  /** Short reason with the numbers, for the reviewer. */
  detail: string;
}

export interface WatchConfig {
  /** Last N hook reactions and reel games kept. */
  samples: number;
  /** Hours of activity kept (168 = one week). */
  hourBuckets: number;
  /** Most fishing spots (tiles) kept per player. */
  maxSpots: number;
  /** Most trade partners kept per player. */
  maxPartners: number;
  /** How often the match saves the numbers. */
  flushMs: number;
  hook: { minSamples: number; maxStdMs: number; minMeanMs: number };
  /** fit = share of reel steps with the fish inside the bar, in permille. */
  reel: { minSamples: number; minFit: number; maxLostRate: number };
  nonstop: { maxStreakHours: number; maxActiveHours: number };
  silent: { minCasts: number };
  spot: { minCasts: number; maxShare: number };
  flow: { minTransfers: number; minValue: number; minShare: number; maxBackRatio: number };
  ip: { maxAccountsPerDay: number; maxOnline: number };
  weights: { [k in FlagKind]: number };
}

export interface Partner {
  n: number;
  value: number;
}

export interface WatchStats {
  /** Bite shown → HOOK received, ms. Last `samples`. */
  hookMs: number[];
  /** Reel fit in permille. Last `samples`. */
  reelFit: number[];
  reels: number;
  reelsLost: number;
  casts: number;
  chats: number;
  /** Casts per wall-clock hour, keyed by floor(ms / 3600000). */
  hours: { [hour: string]: number };
  /** Casts per standing tile "x,y". */
  spots: { [tile: string]: number };
  /** Coin-equivalent value this player gave to / got from each other player (Faz 5 trades). */
  given: { [userId: string]: Partner };
  received: { [userId: string]: Partner };
}

/** Login data kept per account (hooks/auth.ts). */
export interface AccountWatch {
  createdIp: string;
  createdAt: number;
  lastIp: string;
  lastAt: number;
}

export function emptyStats(): WatchStats {
  return { hookMs: [], reelFit: [], reels: 0, reelsLost: 0, casts: 0, chats: 0, hours: {}, spots: {}, given: {}, received: {} };
}

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);
const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'number' && isFinite(x)) : []);
function counts(v: unknown): { [k: string]: number } {
  const out: { [k: string]: number } = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const k in v as object) {
    const c = (v as { [k: string]: unknown })[k];
    if (typeof c === 'number' && isFinite(c)) out[k] = c;
  }
  return out;
}
function partners(v: unknown): { [k: string]: Partner } {
  const out: { [k: string]: Partner } = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const k in v as object) {
    const p = (v as { [k: string]: { n?: unknown; value?: unknown } })[k];
    if (p && typeof p === 'object') out[k] = { n: num(p.n), value: num(p.value) };
  }
  return out;
}

/** Reads a stored value, dropping anything malformed. */
export function normalizeStats(v: unknown): WatchStats {
  if (typeof v !== 'object' || v === null) return emptyStats();
  const o = v as { [k: string]: unknown };
  return {
    hookMs: nums(o.hookMs),
    reelFit: nums(o.reelFit),
    reels: num(o.reels),
    reelsLost: num(o.reelsLost),
    casts: num(o.casts),
    chats: num(o.chats),
    hours: counts(o.hours),
    spots: counts(o.spots),
    given: partners(o.given),
    received: partners(o.received),
  };
}

function push(list: number[], v: number, max: number): void {
  list.push(v);
  if (list.length > max) list.splice(0, list.length - max);
}

/** Keeps the `max` biggest keys. */
function trim<T>(map: { [k: string]: T }, max: number, size: (t: T) => number): void {
  const keys = Object.keys(map);
  if (keys.length <= max) return;
  keys.sort((a, b) => size(map[b]) - size(map[a]));
  for (const k of keys.slice(max)) delete map[k];
}

/**
 * Changes whenever anything the match records changes (every hook and reel
 * follows a cast), so an idle player's unchanged numbers are not written again.
 */
export function changeMark(s: WatchStats): string {
  return s.casts + ':' + s.chats + ':' + s.reels;
}

export const hourOf = (ms: number): number => Math.floor(ms / 3600000);

export function recordCast(s: WatchStats, x: number, y: number, wallMs: number, cfg: WatchConfig): void {
  s.casts++;
  const h = hourOf(wallMs);
  s.hours[h] = (s.hours[h] || 0) + 1;
  for (const k in s.hours) if (Number(k) <= h - cfg.hourBuckets) delete s.hours[k];
  const tile = Math.floor(x) + ',' + Math.floor(y);
  s.spots[tile] = (s.spots[tile] || 0) + 1;
  // Twice the limit before trimming, so a new spot is not dropped at once.
  if (Object.keys(s.spots).length > cfg.maxSpots * 2) trim(s.spots, cfg.maxSpots, (c) => c);
}

export function recordHook(s: WatchStats, reactionMs: number, cfg: WatchConfig): void {
  push(s.hookMs, Math.max(0, Math.round(reactionMs)), cfg.samples);
}

/** `inside` and `steps` come from the replayed reel game. */
export function recordReel(s: WatchStats, inside: number, steps: number, caught: boolean, cfg: WatchConfig): void {
  s.reels++;
  if (!caught) s.reelsLost++;
  if (steps > 0) push(s.reelFit, Math.round((inside / steps) * 1000), cfg.samples);
}

export function recordChat(s: WatchStats): void {
  s.chats++;
}

/** A finished trade or market sale: `value` is its Coin-equivalent worth. */
export function recordTransfer(from: WatchStats, fromId: string, to: WatchStats, toId: string, value: number, cfg: WatchConfig): void {
  const add = (map: { [k: string]: Partner }, id: string) => {
    const p = map[id] || { n: 0, value: 0 };
    map[id] = { n: p.n + 1, value: p.value + Math.max(0, value) };
    trim(map, cfg.maxPartners, (q) => q.value);
  };
  add(from.given, toId);
  add(to.received, fromId);
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}

/** Longest run of back-to-back hours with a cast, and how many hours had one. */
export function activity(s: WatchStats): { streak: number; active: number } {
  const hours = Object.keys(s.hours).map(Number).sort((a, b) => a - b);
  let streak = 0;
  let run = 0;
  for (let i = 0; i < hours.length; i++) {
    run = i > 0 && hours[i] === hours[i - 1] + 1 ? run + 1 : 1;
    if (run > streak) streak = run;
  }
  return { streak, active: hours.length };
}

/** The tile cast from most, and its share of the kept spot counts. */
export function topSpot(s: WatchStats): { tile: string; share: number } | null {
  let tile = '';
  let best = 0;
  let total = 0;
  for (const k in s.spots) {
    total += s.spots[k];
    if (s.spots[k] > best) {
      best = s.spots[k];
      tile = k;
    }
  }
  return total === 0 ? null : { tile, share: best / total };
}

const pct = (x: number) => Math.round(x * 100) + '%';

/** Flags from one player's own numbers. */
export function playerFlags(s: WatchStats, cfg: WatchConfig): Flag[] {
  const out: Flag[] = [];
  if (s.hookMs.length >= cfg.hook.minSamples) {
    const m = mean(s.hookMs);
    const sd = stdDev(s.hookMs);
    if (sd <= cfg.hook.maxStdMs) out.push({ kind: 'hook_regular', detail: `son ${s.hookMs.length} vuruş: sapma ${Math.round(sd)} ms (ort. ${Math.round(m)} ms)` });
    if (m < cfg.hook.minMeanMs) out.push({ kind: 'hook_fast', detail: `ortalama tepki ${Math.round(m)} ms` });
  }
  if (s.reelFit.length >= cfg.reel.minSamples) {
    const fit = mean(s.reelFit);
    const lost = s.reels > 0 ? s.reelsLost / s.reels : 0;
    if (fit >= cfg.reel.minFit && lost <= cfg.reel.maxLostRate) {
      out.push({ kind: 'reel_perfect', detail: `son ${s.reelFit.length} çekme: isabet ‰${Math.round(fit)}, kaçırma ${pct(lost)}` });
    }
  }
  const a = activity(s);
  if (a.streak >= cfg.nonstop.maxStreakHours || a.active >= cfg.nonstop.maxActiveHours) {
    out.push({ kind: 'nonstop', detail: `aralıksız ${a.streak} saat, son ${cfg.hourBuckets} saatin ${a.active}'inde aktif` });
  }
  if (s.casts >= cfg.silent.minCasts && s.chats === 0) {
    out.push({ kind: 'silent', detail: `${s.casts} atış, hiç chat yok` });
  }
  const spot = topSpot(s);
  if (spot && s.casts >= cfg.spot.minCasts && spot.share >= cfg.spot.maxShare) {
    out.push({ kind: 'same_spot', detail: `atışların ${pct(spot.share)}'i aynı yerden (${spot.tile})` });
  }
  let given = 0;
  for (const id in s.given) given += s.given[id].value;
  for (const id in s.given) {
    const g = s.given[id];
    const back = s.received[id] ? s.received[id].value : 0;
    if (g.n >= cfg.flow.minTransfers && g.value >= cfg.flow.minValue && g.value / given >= cfg.flow.minShare && back <= g.value * cfg.flow.maxBackRatio) {
      out.push({ kind: 'one_way_flow', detail: `${g.n} takasta ${g.value} değer tek bir hesaba (${id}), geri gelen ${back}` });
    }
  }
  return out;
}

export interface IpAccount {
  userId: string;
  account: AccountWatch | null;
  online: boolean;
}

export interface IpGroup {
  ip: string;
  /** Accounts created from this IP in the last 24 h. */
  createdToday: string[];
  /** Accounts online now whose last login came from this IP. */
  online: string[];
}

/**
 * Groups accounts by IP. Mobile networks share one IP among many people (CGNAT),
 * so these are weak signals: limits are loose and they weigh little on their own.
 */
export function ipGroups(accounts: IpAccount[], nowMs: number, cfg: WatchConfig): { groups: IpGroup[]; flags: { [userId: string]: Flag[] } } {
  const by: { [ip: string]: IpGroup } = {};
  const group = (ip: string) => (by[ip] = by[ip] || { ip, createdToday: [], online: [] });
  for (const a of accounts) {
    if (!a.account) continue;
    if (a.account.createdIp && nowMs - a.account.createdAt < 24 * 3600000) group(a.account.createdIp).createdToday.push(a.userId);
    if (a.online && a.account.lastIp) group(a.account.lastIp).online.push(a.userId);
  }
  const flags: { [userId: string]: Flag[] } = {};
  const add = (id: string, f: Flag) => (flags[id] = flags[id] || []).push(f);
  const groups: IpGroup[] = [];
  for (const ip in by) {
    const g = by[ip];
    const many = g.createdToday.length > cfg.ip.maxAccountsPerDay;
    const crowd = g.online.length > cfg.ip.maxOnline;
    if (many) for (const id of g.createdToday) add(id, { kind: 'ip_accounts', detail: `${ip} adresinden son 24 saatte ${g.createdToday.length} hesap` });
    if (crowd) for (const id of g.online) add(id, { kind: 'ip_online', detail: `${ip} adresinden şu an ${g.online.length} oturum` });
    if (g.createdToday.length > 1 || g.online.length > 1) groups.push(g);
  }
  groups.sort((a, b) => Math.max(b.createdToday.length, b.online.length) - Math.max(a.createdToday.length, a.online.length));
  return { groups, flags };
}

export function scoreOf(flags: Flag[], cfg: WatchConfig): number {
  return flags.reduce((a, f) => a + (cfg.weights[f.kind] || 0), 0);
}
