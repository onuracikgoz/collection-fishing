// Shared paths and helpers for the agent hooks, statusline and dashboard.
// All agent state lives outside the repo so every worktree and the test folder share it:
//   $CG_AGENTS_HOME (default ~/.cg-agents)
//     agents/<name>/hook.json        last hook event (status, activity, prompt, tmux pane)
//     agents/<name>/status.json      last statusline input (model, context window, cost)
//     agents/<name>/sessions/<id>.json   cost per Claude session (summed for totals)
//     agents/<name>/events.jsonl     recent events (trimmed)
//     tests/<id>.json                test folder runs (written by testbed.sh)
import { mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

export const HOME = process.env.CG_AGENTS_HOME || join(homedir(), '.cg-agents');
export const AGENTS_DIR = join(HOME, 'agents');
export const TESTS_DIR = join(HOME, 'tests');

export function agentName(cwd) {
  const raw = process.env.CG_AGENT || `adhoc-${basename(cwd || process.cwd())}`;
  return raw.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 40) || 'adhoc';
}

export function agentDir(name) {
  const dir = join(AGENTS_DIR, name);
  mkdirSync(join(dir, 'sessions'), { recursive: true });
  return dir;
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Write to a temp file and rename so readers never see half a file.
export function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, file);
}

export function appendEvent(dir, event) {
  const file = join(dir, 'events.jsonl');
  appendFileSync(file, JSON.stringify(event) + '\n');
  try {
    if (statSync(file).size > 256 * 1024) {
      const lines = readFileSync(file, 'utf8').trim().split('\n').slice(-200);
      writeFileSync(file, lines.join('\n') + '\n');
    }
  } catch {}
}

export async function readStdinJson() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function clip(text, n = 160) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
