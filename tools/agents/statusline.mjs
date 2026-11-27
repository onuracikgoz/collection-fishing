#!/usr/bin/env node
// Claude Code statusLine command. Claude Code pipes session JSON (model, cost,
// context window, and on newer versions plan rate limits) on stdin after each
// update. We save it for the dashboard and print a one-line status for the pane.
import { join } from 'node:path';
import { agentDir, agentName, readStdinJson, writeJson } from './lib/state.mjs';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function contextOf(cw = {}, input = {}) {
  const size = num(cw.context_window_size) || (input.exceeds_200k_tokens ? 1_000_000 : 200_000);
  const u = cw.current_usage || null;
  const used = u
    ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0)
    : null;
  let pct = num(cw.used_percentage);
  if (pct == null && used != null && size) pct = (used / size) * 100;
  return { usedPct: pct == null ? null : Math.round(pct * 10) / 10, usedTokens: used, size };
}

let line = '';
try {
  const input = await readStdinJson();
  const name = agentName(input.cwd || input.workspace?.current_dir);
  const dir = agentDir(name);
  const now = new Date().toISOString();
  const context = contextOf(input.context_window || {}, input);
  const cost = {
    usd: num(input.cost?.total_cost_usd) ?? 0,
    durationMs: num(input.cost?.total_duration_ms),
    apiDurationMs: num(input.cost?.total_api_duration_ms),
    linesAdded: num(input.cost?.total_lines_added),
    linesRemoved: num(input.cost?.total_lines_removed),
  };
  writeJson(join(dir, 'status.json'), {
    sessionId: input.session_id || null,
    model: input.model?.display_name || input.model?.id || null,
    version: input.version || null,
    context,
    cost,
    rateLimits: input.rate_limits || null,
    updatedAt: now,
  });
  const sid = String(input.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (sid) {
    writeJson(join(dir, 'sessions', `${sid}.json`), { sessionId: sid, usd: cost.usd, day: now.slice(0, 10), updatedAt: now });
  }
  const pct = context.usedPct == null ? '?' : `${Math.round(context.usedPct)}%`;
  line = `${name} · ${input.model?.display_name || ''} · bağlam ${pct} · $${cost.usd.toFixed(2)}`;
} catch {
  line = process.env.CG_AGENT || 'claude';
}
process.stdout.write(line + '\n');
