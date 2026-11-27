#!/bin/bash
# Starts the agents from agents.conf in tmux, one window each, plus the dashboard.
#   agents.sh up [name…]     start everything (or only the named agents); opens the dashboard
#   agents.sh attach         look at the panes (Ctrl-b n / p: next / previous, Ctrl-b d: leave, agents keep running)
#   agents.sh status         which windows are running
#   agents.sh stop <name>    close one agent (its window)
#   agents.sh down           close every agent and the dashboard
#   agents.sh phone          the dashboard address for your phone (Tailscale), with a QR code
set -e
. "$(dirname "$0")/env.sh"
CONF="$AGENTS_TOOLS/agents.conf"
SETTINGS="$CG_AGENTS_HOME/claude-settings.json"
PORT="${PORT:-7380}"

command -v tmux >/dev/null || { echo "tmux yok. Kur: brew install tmux"; exit 1; }
command -v claude >/dev/null || { echo "claude komutu yok (Claude Code)."; exit 1; }

# Hooks and statusline are passed with --settings and point at the main checkout,
# so they work the same in every worktree, whatever branch it is on.
write_settings() {
  local hook="node '$AGENTS_TOOLS/hook.mjs'"
  AGENTS_HOOK="$hook" AGENTS_STATUS="node '$AGENTS_TOOLS/statusline.mjs'" SETTINGS="$SETTINGS" node -e '
    const e = process.env, h = [{ hooks: [{ type: "command", command: e.AGENTS_HOOK, timeout: 5 }] }];
    const m = [{ matcher: "*", hooks: h[0].hooks }];
    // Rules only for the agents; sessions Onur starts by hand use the repo settings alone.
    const deny = ["Bash(git push --force:*)", "Bash(git push -f:*)", "Bash(git push origin main:*)", "Bash(git push origin HEAD:main:*)",
      "Bash(gh pr merge:*)", "Bash(git reset --hard:*)", "Bash(rm -rf:*)", "Bash(*Unity.app*)", "Bash(*/Unity -batchmode*)",
      "Read(./.env)", "Read(./**/.env)", "Edit(./client/Library/**)", "Edit(./client/ProjectSettings/**)"];
    const s = {
      permissions: { deny },
      statusLine: { type: "command", command: e.AGENTS_STATUS, padding: 0 },
      hooks: { SessionStart: h, UserPromptSubmit: h, PreToolUse: m, PostToolUse: m, Notification: h, Stop: h, SessionEnd: h },
    };
    require("fs").writeFileSync(e.SETTINGS, JSON.stringify(s, null, 2));'
}

resolve_dir() {
  case "$1" in
    main) echo "$MAIN_REPO" ;;
    wt:*) "$AGENTS_TOOLS/worktree.sh" new "${1#wt:}" ;;
    *) echo "$1" ;;
  esac
}

has_window() { tmux list-windows -t "$TMUX_SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$1"; }

tailscale_ip() {
  local ts
  for ts in tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale; do
    if command -v "$ts" >/dev/null 2>&1; then "$ts" ip -4 2>/dev/null | head -1; return; fi
  done
}

# Token the phone needs; the Mac's own browser (127.0.0.1) does not.
dash_token() {
  local f="$CG_AGENTS_HOME/dash-token"
  if [ ! -s "$f" ]; then (umask 077; openssl rand -hex 16 > "$f"); fi
  cat "$f"
}

start_dashboard() {
  local hosts="127.0.0.1" ip
  ip=$(tailscale_ip)
  if [ -n "$ip" ]; then hosts="127.0.0.1,$ip"; dash_token >/dev/null; fi
  tmux send-keys -t "$TMUX_SESSION:dashboard" "PORT=$PORT HOST=$hosts node '$AGENTS_TOOLS/dashboard/serve.mjs'" Enter
}

ensure_session() {
  if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux new-session -d -s "$TMUX_SESSION" -n dashboard -c "$MAIN_REPO"
    start_dashboard
  fi
}

start_agent() {
  local name="$1" role="$2" where="$3" mode="${4:-default}" model="${5:--}" dir extra=""
  if has_window "$name"; then echo "  $name zaten çalışıyor"; return; fi
  dir=$(resolve_dir "$where")
  [ "$role" = "tester" ] && extra="--add-dir '$TESTBED' --add-dir '$CG_AGENTS_HOME/tests'"
  [ "$model" != "-" ] && extra="$extra --model $model"
  tmux new-window -d -t "$TMUX_SESSION:" -n "$name" -c "$dir"
  tmux send-keys -t "$TMUX_SESSION:$name" \
    "CG_AGENT=$name CG_ROLE=$role claude --agent $role -n $name --permission-mode $mode --settings '$SETTINGS' --add-dir '$CG_AGENTS_HOME/tasks' $extra" Enter
  echo "  $name ($role) → $dir"
}

each_agent() { # calls "$@" name role dir mode model for every line of agents.conf
  grep -vE '^[[:space:]]*(#|$)' "$CONF" | while read -r name role where mode model; do "$@" "$name" "$role" "$where" "$mode" "${model:--}"; done
}

case "${1:-}" in
  up)
    shift
    write_settings
    ensure_session
    wanted=" $* "
    pick() { if [ "$wanted" = "  " ] || [[ "$wanted" == *" $1 "* ]]; then start_agent "$@"; fi; }
    each_agent pick
    echo "Dashboard: http://127.0.0.1:$PORT   Panelleri görmek: ./cg agents attach"
    if command -v open >/dev/null; then (sleep 2 && open "http://127.0.0.1:$PORT") & fi
    ;;
  attach)
    tmux attach -t "$TMUX_SESSION"
    ;;
  status)
    tmux list-windows -t "$TMUX_SESSION" -F '#{window_name}  #{pane_current_command}  #{pane_current_path}' 2>/dev/null || echo "Çalışan ajan yok."
    ;;
  stop)
    [ -n "${2:-}" ] || { echo "kullanım: agents.sh stop <ad>"; exit 1; }
    tmux send-keys -t "$TMUX_SESSION:$2" C-c 2>/dev/null; sleep 0.3
    tmux send-keys -t "$TMUX_SESSION:$2" C-c 2>/dev/null; sleep 0.5
    tmux kill-window -t "$TMUX_SESSION:$2"
    ;;
  phone)
    ip=$(tailscale_ip)
    if [ -z "$ip" ]; then
      echo "Tailscale bulunamadı ya da kapalı. Mac'e ve telefona Tailscale kur, aynı hesapla gir, sonra tekrar dene."
      exit 1
    fi
    url="http://$ip:$PORT/?token=$(dash_token)"
    # Restart the dashboard so it also listens on the Tailscale address.
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      tmux send-keys -t "$TMUX_SESSION:dashboard" C-c; sleep 0.5; start_dashboard
    else
      echo "Ajanlar çalışmıyor; önce ./cg agents up"
    fi
    echo "Telefonda aç (Tailscale açıkken): $url"
    if command -v qrencode >/dev/null; then qrencode -t ANSIUTF8 "$url"; else echo "(QR kod için: brew install qrencode)"; fi
    ;;
  down)
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null && echo "Kapatıldı." || echo "Zaten kapalı."
    ;;
  *)
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
