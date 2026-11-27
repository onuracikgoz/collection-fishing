#!/bin/bash
# The one test folder. A git worktree next to the repo (collection-fishing-testbed)
# whose client/Library stays between runs, so Unity imports only what changed.
# Runs one test at a time (a lock); a second caller waits or gets "meşgul".
#
#   testbed.sh setup                       create the folder (first Unity import is slow)
#   testbed.sh run <branch> [kind] [--filter <test name>] [--wait]
#        kind: server (npm test) | edit (Unity EditMode) | play (Unity PlayMode) | all (server + edit, default)
#   testbed.sh status                      what is running, last results
#
# Results: ~/.cg-agents/tests/<id>.json (the dashboard shows them), logs next to them.
# Exit code: 0 passed, 1 failed, 2 error, 3 busy.
set -u
. "$(dirname "$0")/env.sh"
LOCK="$CG_AGENTS_HOME/testbed.lock"

unity_bin() {
  if [ -n "${UNITY:-}" ]; then echo "$UNITY"; return; fi
  local version
  version=$(grep m_EditorVersion: "$TESTBED/client/ProjectSettings/ProjectVersion.txt" | awk '{print $2}')
  echo "/Applications/Unity/Hub/Editor/$version/Unity.app/Contents/MacOS/Unity"
}

setup() {
  if [ -d "$TESTBED/.git" ] || [ -f "$TESTBED/.git" ]; then echo "Test klasörü hazır: $TESTBED"; return 0; fi
  git -C "$MAIN_REPO" fetch -q origin main || true
  git -C "$MAIN_REPO" worktree add -q --detach "$TESTBED" origin/main || return 2
  echo "Test klasörü oluşturuldu: $TESTBED"
  echo "İlk Unity testi Library/ klasörünü baştan kurar, 10-20 dk sürebilir. Sonrakiler hızlı."
}

# write_result <status> [total passed failed]
write_result() {
  R_STATUS="$1" R_TOTAL="${2:-}" R_PASSED="${3:-}" R_FAILED="${4:-}" R_END="$(date +%s)" \
  R_FILE="$RESULT" R_ID="$ID" R_BRANCH="$BRANCH" R_COMMIT="$COMMIT" R_KIND="$KIND" R_START="$START" R_LOG="$LOGDIR" R_FILTER="$FILTER" R_NOTE="${NOTE:-}" \
  node -e '
    const e = process.env, n = (v) => (v === "" ? null : Number(v));
    const out = { id: e.R_ID, branch: e.R_BRANCH, commit: e.R_COMMIT, kind: e.R_KIND, filter: e.R_FILTER || null,
      status: e.R_STATUS, total: n(e.R_TOTAL), passed: n(e.R_PASSED), failed: n(e.R_FAILED),
      startedAt: new Date(e.R_START * 1000).toISOString(), seconds: e.R_STATUS === "running" ? null : Number(e.R_END) - Number(e.R_START),
      log: e.R_LOG, note: e.R_NOTE || null };
    require("fs").writeFileSync(e.R_FILE, JSON.stringify(out, null, 2));'
}

# Reads "total passed failed" from a Unity NUnit XML.
xml_counts() {
  local head
  head=$(grep -o '<test-run[^>]*>' "$1" 2>/dev/null | head -1)
  [ -n "$head" ] || { echo ""; return; }
  attr() { echo "$head" | sed -n "s/.* $1=\"\([0-9]*\)\".*/\1/p"; }
  echo "$(attr total) $(attr passed) $(attr failed)"
}

run_server() {
  echo "== Sunucu testleri (npm test)"
  cd "$TESTBED/server" || return 2
  local hash
  hash=$(shasum package-lock.json | awk '{print $1}')
  if [ ! -d node_modules ] || [ "$(cat node_modules/.cg-lockhash 2>/dev/null)" != "$hash" ]; then
    echo "   npm ci (package-lock değişti)"
    { npm ci --allow-git=all || npm ci; } >"$LOGDIR/npm-ci.log" 2>&1 || { echo "   npm ci başarısız, log: $LOGDIR/npm-ci.log"; return 2; }
    echo "$hash" > node_modules/.cg-lockhash
  fi
  local rc=0 line t p f
  npm test >"$LOGDIR/server.log" 2>&1 || rc=1
  # vitest summary, e.g. "Tests  2 failed | 401 passed (403)"
  line=$(grep -E "^ *Tests +[0-9]" "$LOGDIR/server.log" | tail -1)
  t=$(echo "$line" | sed -n 's/.*(\([0-9]*\)).*/\1/p'); p=$(echo "$line" | sed -n 's/.* \([0-9]*\) passed.*/\1/p'); f=$(echo "$line" | sed -n 's/.* \([0-9]*\) failed.*/\1/p')
  TOTAL=$(( ${TOTAL:-0} + ${t:-0} )); PASSED=$(( ${PASSED:-0} + ${p:-0} )); FAILED=$(( ${FAILED:-0} + ${f:-0} ))
  if [ $rc -eq 0 ]; then echo "  $line"; return 0; fi
  grep -E "FAIL|AssertionError|Error:" "$LOGDIR/server.log" | head -30
  return 1
}

run_unity() {
  local platform="$1" unity xml code
  unity=$(unity_bin)
  [ -x "$unity" ] || { echo "Unity bulunamadı: $unity (UNITY=... ile ver)"; return 2; }
  xml="$LOGDIR/unity-$platform.xml"
  echo "== Unity $platform testleri (batch mode, log: $LOGDIR/unity-$platform.log)"
  local args=(-batchmode -nographics -projectPath "$TESTBED/client" -runTests -testPlatform "$platform" -testResults "$xml" -logFile "$LOGDIR/unity-$platform.log")
  [ -n "$FILTER" ] && args+=(-testFilter "$FILTER")
  "$unity" "${args[@]}"
  code=$?
  read -r T P F <<<"$(xml_counts "$xml")"
  TOTAL=$(( ${TOTAL:-0} + ${T:-0} )); PASSED=$(( ${PASSED:-0} + ${P:-0} )); FAILED=$(( ${FAILED:-0} + ${F:-0} ))
  if [ -n "${T:-}" ]; then echo "   $P / $T geçti, $F kaldı"; fi
  if [ "$code" -eq 0 ]; then return 0; fi
  if [ "$code" -eq 2 ]; then
    grep -o '<test-case [^>]*result="Failed"[^>]*>' "$xml" | sed -n 's/.*fullname="\([^"]*\)".*/   KALDI: \1/p' | head -20
    return 1
  fi
  echo "   Unity hata koduyla çıktı ($code). Derleme hatası olabilir:"
  grep -E "error CS|Scripts have compiler errors|Aborting batchmode" "$LOGDIR/unity-$platform.log" | head -15
  return 2
}

run() {
  BRANCH="${1:-}"; shift || true
  [ -n "$BRANCH" ] || { echo "kullanım: testbed.sh run <branch> [server|edit|play|all] [--filter ad] [--wait]"; exit 2; }
  KIND="all"; FILTER=""; WAIT=0
  while [ $# -gt 0 ]; do
    case "$1" in
      server|edit|play|all) KIND="$1" ;;
      --filter) FILTER="$2"; shift ;;
      --wait) WAIT=1 ;;
    esac
    shift
  done

  until mkdir "$LOCK" 2>/dev/null; do
    if [ "$WAIT" -eq 0 ]; then echo "Test klasörü meşgul: $(cat "$LOCK/what" 2>/dev/null). --wait ile sıraya gir."; exit 3; fi
    # A lock left by a killed run: its process is gone.
    if ! kill -0 "$(cat "$LOCK/pid" 2>/dev/null)" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
    sleep 10
  done
  echo $$ > "$LOCK/pid"; echo "$BRANCH ($KIND)" > "$LOCK/what"
  trap 'rm -rf "$LOCK"' EXIT

  setup >/dev/null || exit 2
  cd "$TESTBED" || exit 2
  git -C "$MAIN_REPO" fetch -q origin 2>/dev/null || true
  # Local branches are shared by all worktrees; fall back to the pushed one.
  local ref="$BRANCH"
  git rev-parse -q --verify "$ref^{commit}" >/dev/null || ref="origin/$BRANCH"
  git rev-parse -q --verify "$ref^{commit}" >/dev/null || { echo "Branch bulunamadı: $BRANCH"; exit 2; }
  # Ignored folders (client/Library, node_modules) survive; tracked changes are thrown away.
  git checkout -q --detach -f "$ref" && git clean -fdq || exit 2
  COMMIT=$(git rev-parse HEAD)

  START=$(date +%s)
  ID="$(date +%Y%m%d-%H%M%S)-$(printf '%s' "$BRANCH" | tr -c 'A-Za-z0-9_-' '-' | cut -c1-40)"
  LOGDIR="$CG_AGENTS_HOME/tests/$ID"; RESULT="$CG_AGENTS_HOME/tests/$ID.json"
  mkdir -p "$LOGDIR"
  TOTAL=""; PASSED=""; FAILED=""
  write_result running
  echo "Test: $BRANCH @ ${COMMIT:0:7} ($KIND)"

  local worst=0 rc
  case "$KIND" in
    server) run_server; worst=$? ;;
    edit) run_unity EditMode; worst=$? ;;
    play) run_unity PlayMode; worst=$? ;;
    all)
      run_server; rc=$?; [ $rc -gt $worst ] && worst=$rc
      cd "$TESTBED"
      run_unity EditMode; rc=$?; [ $rc -gt $worst ] && worst=$rc
      ;;
  esac

  case "$worst" in
    0) write_result passed "$TOTAL" "$PASSED" "$FAILED"; echo "SONUÇ: GEÇTİ" ;;
    1) write_result failed "$TOTAL" "$PASSED" "$FAILED"; echo "SONUÇ: KALDI" ;;
    *) write_result error "$TOTAL" "$PASSED" "$FAILED"; echo "SONUÇ: HATA (testler çalışamadı)" ;;
  esac
  echo "Loglar: $LOGDIR"
  exit "$worst"
}

case "${1:-}" in
  setup) setup ;;
  run) shift; run "$@" ;;
  status)
    if [ -d "$LOCK" ]; then echo "Çalışıyor: $(cat "$LOCK/what" 2>/dev/null)"; else echo "Boşta"; fi
    ls -t "$CG_AGENTS_HOME/tests/"*.json 2>/dev/null | head -5 | while read -r f; do
      node -e 'const t=require(process.argv[1]); console.log(`${t.startedAt}  ${t.branch}  ${t.kind}  ${t.status}  ${t.passed ?? "-"}/${t.total ?? "-"}`)' "$f"
    done
    ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
