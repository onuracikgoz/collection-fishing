# Shared paths for the agent scripts. Sourced, not run. Works with macOS bash 3.2.
AGENTS_TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$AGENTS_TOOLS/../.." && pwd)"
# The main checkout (worktrees point back to it), so every script agrees on paths
# no matter which worktree it was started from.
MAIN_REPO="$(cd "$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir)/.." && pwd)"
CG_AGENTS_HOME="${CG_AGENTS_HOME:-$HOME/.cg-agents}"
WORKTREES="${CG_WORKTREES:-$(dirname "$MAIN_REPO")/$(basename "$MAIN_REPO")-worktrees}"
TESTBED="${CG_TESTBED:-$(dirname "$MAIN_REPO")/$(basename "$MAIN_REPO")-testbed}"
TMUX_SESSION="${CG_TMUX_SESSION:-cg}"
export CG_AGENTS_HOME
mkdir -p "$CG_AGENTS_HOME/agents" "$CG_AGENTS_HOME/tests" "$CG_AGENTS_HOME/tasks"
