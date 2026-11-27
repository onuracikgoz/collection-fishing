#!/bin/bash
# Sends a prompt to an agent's tmux window, like the dashboard's "Gönder" button.
#   send.sh <name> "prompt"        or:  echo "prompt" | send.sh <name>
set -e
. "$(dirname "$0")/env.sh"
name="$1"; shift || true
[ -n "$name" ] || { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
text="$*"; [ -n "$text" ] || text="$(cat)"
[ -n "$text" ] || { echo "Boş prompt"; exit 1; }
target="$TMUX_SESSION:$name"
tmux has-session -t "$target" 2>/dev/null || { echo "$name çalışmıyor"; exit 1; }
tmux set-buffer -b cgsend -- "$text"
tmux paste-buffer -p -d -b cgsend -t "$target"
sleep 0.25
tmux send-keys -t "$target" Enter
