#!/usr/bin/env node
// Claude Code hook: records what an agent is doing for the dashboard.
// Wired in .claude/settings.json for SessionStart, UserPromptSubmit, PreToolUse,
// PostToolUse, Notification, Stop and SessionEnd. Prints nothing (stdout of some
// hooks is added to the model's context) and always exits 0 so it never blocks work.
import { join } from 'node:path';
import { agentDir, agentName, appendEvent, clip, readJson, readStdinJson, writeJson } from './lib/state.mjs';

function describeTool(name, input = {}) {
  const short = (p) => String(p || '').split('/').slice(-3).join('/');
  switch (name) {
    case 'Bash': return `Bash: ${clip(input.command, 120)}`;
    case 'Read': return `Okuyor: ${short(input.file_path)}`;
    case 'Edit':
    case 'MultiEdit': return `Düzenliyor: ${short(input.file_path)}`;
    case 'Write': return `Yazıyor: ${short(input.file_path)}`;
    case 'Grep': return `Arıyor: ${clip(input.pattern, 80)}`;
    case 'Glob': return `Dosya arıyor: ${clip(input.pattern, 80)}`;
    case 'Task':
    case 'Agent': return `Alt ajan: ${clip(input.description || input.prompt, 80)}`;
    case 'WebFetch': return `Web: ${clip(input.url, 100)}`;
    case 'WebSearch': return `Web araması: ${clip(input.query, 80)}`;
    case 'TodoWrite': return 'Yapılacaklar listesini güncelliyor';
    default: return clip(name, 80);
  }
}

try {
  const input = await readStdinJson();
  const event = input.hook_event_name || process.argv[2] || 'unknown';
  const name = agentName(input.cwd);
  const dir = agentDir(name);
  const file = join(dir, 'hook.json');
  const now = new Date().toISOString();
  const prev = readJson(file, {});
  const state = {
    ...prev,
    name,
    role: process.env.CG_ROLE || prev.role || null,
    sessionId: input.session_id || prev.sessionId || null,
    cwd: input.cwd || prev.cwd || process.cwd(),
    pane: process.env.TMUX_PANE || prev.pane || null,
    updatedAt: now,
  };
  let summary = '';

  switch (event) {
    case 'SessionStart':
      Object.assign(state, { status: 'idle', activity: `Oturum başladı (${input.source || 'startup'})`, startedAt: now, lastMessage: null });
      summary = state.activity;
      break;
    case 'UserPromptSubmit':
      Object.assign(state, { status: 'working', activity: 'Düşünüyor', lastPrompt: clip(input.prompt, 400), lastPromptAt: now, lastMessage: null });
      summary = `Prompt: ${clip(input.prompt, 120)}`;
      break;
    case 'PreToolUse':
      Object.assign(state, { status: 'working', activity: describeTool(input.tool_name, input.tool_input), lastMessage: null });
      summary = state.activity;
      break;
    case 'PostToolUse':
      state.status = 'working';
      break;
    case 'Notification':
      // Permission prompts and "waiting for your input" both arrive here.
      Object.assign(state, { status: 'waiting', lastMessage: clip(input.message, 200) });
      summary = `Bekliyor: ${state.lastMessage}`;
      break;
    case 'Stop':
      Object.assign(state, { status: 'idle', activity: 'Bitti, sıradaki prompt bekleniyor' });
      summary = 'Turu bitirdi';
      break;
    case 'SessionEnd':
      Object.assign(state, { status: 'ended', activity: `Oturum kapandı (${input.reason || 'exit'})` });
      summary = state.activity;
      break;
  }

  writeJson(file, state);
  if (summary) appendEvent(dir, { at: now, event, text: summary });
} catch {
  // Never break the agent because the dashboard could not record something.
}
process.exit(0);
