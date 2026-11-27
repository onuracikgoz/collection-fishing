#!/bin/bash
# Git worktrees for developer agents. Each developer gets its own folder next to the
# repo (collection-fishing-worktrees/<name>) and never touches Unity.
#   worktree.sh new <name> [base]   create (base: origin/main)
#   worktree.sh path <name>         print the folder
#   worktree.sh list
#   worktree.sh rm <name>           remove the folder (branches stay)
set -e
. "$(dirname "$0")/env.sh"

cmd="$1"; name="$2"
case "$cmd" in
  new)
    [ -n "$name" ] || { echo "kullanım: worktree.sh new <ad> [base]"; exit 1; }
    dir="$WORKTREES/$name"
    if [ -d "$dir" ]; then echo "$dir"; exit 0; fi
    base="${3:-origin/main}"
    git -C "$MAIN_REPO" fetch -q origin main || echo "uyarı: origin'den çekilemedi, yerel $base kullanılıyor" >&2
    mkdir -p "$WORKTREES"
    # Detached at base; the developer creates agent/<task> branches inside it.
    git -C "$MAIN_REPO" worktree add -q --detach "$dir" "$base" >&2
    # Server tests need node_modules; install once so the developer can run npm test.
    if [ -f "$dir/server/package-lock.json" ]; then
      (cd "$dir/server" && npm ci --silent --allow-git=all >/dev/null 2>&1 || npm ci --silent >/dev/null 2>&1 || true)
    fi
    echo "$dir"
    ;;
  path)
    echo "$WORKTREES/$name"
    ;;
  list)
    git -C "$MAIN_REPO" worktree list
    ;;
  rm)
    [ -n "$name" ] || { echo "kullanım: worktree.sh rm <ad>"; exit 1; }
    git -C "$MAIN_REPO" worktree remove "$WORKTREES/$name"
    ;;
  *)
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
