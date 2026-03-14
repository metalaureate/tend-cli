#!/usr/bin/env bash
# Test suite for tend CLI
# Run: bash test_tend.sh

set -uo pipefail

TEND="$(cd "$(dirname "$0")" && pwd)/tend"
PASS=0
FAIL=0
TEST_DIR=""

# ─── Test Helpers ────────────────────────────────────────────────────────────

setup() {
  TEST_DIR=$(mktemp -d)
  export TEND_ROOT="$TEST_DIR"
  export HOME="$TEST_DIR/fakehome"
  export NO_COLOR=1
  mkdir -p "$HOME"
  touch "$HOME/.zshrc"
}

teardown() {
  [[ -n "$TEST_DIR" ]] && rm -rf "$TEST_DIR"
}

# Create a mock project with git repo
make_project() {
  local name="$1"
  local dir="${2:-$TEST_DIR/$name}"
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" commit --allow-empty -m "initial commit" -q
  echo "$dir"
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  ✓ $label"
    (( PASS++ ))
  else
    echo "  ✗ $label"
    echo "    expected: $(echo "$expected" | head -3)"
    echo "    actual:   $(echo "$actual" | head -3)"
    (( FAIL++ ))
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ✓ $label"
    (( PASS++ ))
  else
    echo "  ✗ $label"
    echo "    expected to contain: $needle"
    echo "    actual: $(echo "$haystack" | head -3)"
    (( FAIL++ ))
  fi
}

assert_not_contains() {
  local label="$1" needle="$2" haystack="$3"
  if ! echo "$haystack" | grep -qF "$needle"; then
    echo "  ✓ $label"
    (( PASS++ ))
  else
    echo "  ✗ $label"
    echo "    expected NOT to contain: $needle"
    (( FAIL++ ))
  fi
}

assert_file_exists() {
  local label="$1" file="$2"
  if [[ -f "$file" ]]; then
    echo "  ✓ $label"
    (( PASS++ ))
  else
    echo "  ✗ $label — file not found: $file"
    (( FAIL++ ))
  fi
}

assert_exit() {
  local label="$1" expected_code="$2"
  shift 2
  local actual_code=0
  "$@" >/dev/null 2>&1 || actual_code=$?
  if [[ "$actual_code" == "$expected_code" ]]; then
    echo "  ✓ $label"
    (( PASS++ ))
  else
    echo "  ✗ $label — expected exit $expected_code, got $actual_code"
    (( FAIL++ ))
  fi
}

# ─── Tests ───────────────────────────────────────────────────────────────────

test_version() {
  echo "test: version"
  local out
  out=$("$TEND" version)
  assert_contains "shows version" "tend 0.1.0" "$out"
}

test_help() {
  echo "test: help"
  local out
  out=$("$TEND" help)
  assert_contains "shows usage" "Usage:" "$out"
  assert_contains "lists commands" "tend init" "$out"
  assert_contains "lists status" "tend status" "$out"

  # -h and --help also work
  local out2 out3
  out2=$("$TEND" -h)
  out3=$("$TEND" --help)
  assert_eq "-h matches help" "$out" "$out2"
  assert_eq "--help matches help" "$out" "$out3"
}

test_init_creates_tend_dir() {
  echo "test: init creates .tend/ directory"
  local dir
  dir=$(make_project "alpha")
  cd "$dir"
  "$TEND" init
  assert_file_exists "events file" "$dir/.tend/events"
  assert_file_exists "TODO file" "$dir/.tend/TODO"
  assert_file_exists "DONE file" "$dir/.tend/DONE"
  assert_file_exists "NOTES file" "$dir/.tend/NOTES"
}

test_init_creates_agents_md() {
  echo "test: init creates AGENTS.md"
  local dir
  dir=$(make_project "bravo")
  cd "$dir"
  "$TEND" init
  assert_file_exists "AGENTS.md created" "$dir/AGENTS.md"
  local content
  content=$(cat "$dir/AGENTS.md")
  assert_contains "has tend integration header" "Tend Integration" "$content"
  assert_contains "has emit instructions" "tend emit" "$content"
  assert_contains "has fallback echo" ".tend/events" "$content"
}

test_init_appends_to_existing_agents_md() {
  echo "test: init appends to existing AGENTS.md"
  local dir
  dir=$(make_project "charlie")
  echo "# My Agent Rules" > "$dir/AGENTS.md"
  echo "Be nice." >> "$dir/AGENTS.md"
  cd "$dir"
  "$TEND" init
  local content
  content=$(cat "$dir/AGENTS.md")
  assert_contains "preserves existing content" "My Agent Rules" "$content"
  assert_contains "appends tend block" "Tend Integration" "$content"
}

test_init_idempotent_agents_md() {
  echo "test: init is idempotent for AGENTS.md"
  local dir
  dir=$(make_project "delta")
  cd "$dir"
  "$TEND" init
  "$TEND" init
  local count
  count=$(grep -c "Tend Integration" "$dir/AGENTS.md")
  assert_eq "only one tend block" "1" "$count"
}

test_init_registers_project() {
  echo "test: init registers project in ~/.tend/projects"
  local dir
  dir=$(make_project "echo-proj")
  cd "$dir"
  "$TEND" init
  local registry="$HOME/.tend/projects"
  assert_file_exists "registry exists" "$registry"
  local content
  content=$(cat "$registry")
  assert_contains "project path registered" "$dir" "$content"
}

test_init_registry_idempotent() {
  echo "test: init doesn't duplicate registry entry"
  local dir
  dir=$(make_project "foxtrot")
  cd "$dir"
  "$TEND" init
  "$TEND" init
  local count
  count=$(grep -c "$dir" "$HOME/.tend/projects")
  assert_eq "only one registry entry" "1" "$count"
}

test_init_shell_integration() {
  echo "test: init adds shell integration"
  local dir
  dir=$(make_project "golf")
  cd "$dir"
  "$TEND" init
  local zshrc
  zshrc=$(cat "$HOME/.zshrc")
  assert_contains "adds precmd hook" "_tend_precmd" "$zshrc"
  assert_contains "adds RPROMPT" "RPROMPT" "$zshrc"
}

test_init_shell_idempotent() {
  echo "test: init doesn't duplicate shell integration"
  local dir
  dir=$(make_project "hotel")
  cd "$dir"
  "$TEND" init
  "$TEND" init
  local count
  count=$(grep -c "Tend status indicator" "$HOME/.zshrc")
  assert_eq "only one shell block" "1" "$count"
}

test_emit_valid_states() {
  echo "test: emit accepts valid states"
  local dir
  dir=$(make_project "india")
  cd "$dir"
  "$TEND" init

  for state in working done stuck waiting idle; do
    "$TEND" emit "$state" "test $state"
  done

  local lines
  lines=$(wc -l < "$dir/.tend/events" | tr -d ' ')
  assert_eq "5 events written" "5" "$lines"

  local last
  last=$(tail -1 "$dir/.tend/events")
  assert_contains "last event is idle" "idle test idle" "$last"
}

test_emit_invalid_state() {
  echo "test: emit rejects invalid state"
  local dir
  dir=$(make_project "juliet")
  cd "$dir"
  "$TEND" init
  assert_exit "rejects 'running'" 1 "$TEND" emit running "test"
  assert_exit "rejects 'error'" 1 "$TEND" emit error "test"
}

test_emit_requires_init() {
  echo "test: emit fails without .tend/"
  local dir
  dir=$(make_project "kilo")
  cd "$dir"
  assert_exit "fails without init" 1 "$TEND" emit working "test"
}

test_status_no_attention() {
  echo "test: status shows ○ when nothing needs attention"
  local dir
  dir=$(make_project "lima")
  cd "$dir"
  "$TEND" init
  "$TEND" emit working "building"
  local out
  out=$("$TEND" status)
  assert_eq "shows ○" "○" "$out"
}

test_status_needs_attention() {
  echo "test: status shows ●N for needs-attention states"
  local dir1 dir2
  dir1=$(make_project "mike")
  dir2=$(make_project "november")
  cd "$dir1" && "$TEND" init && "$TEND" emit done "PR ready"
  cd "$dir2" && "$TEND" init && "$TEND" emit stuck "approval needed"
  local out
  out=$("$TEND" status)
  assert_eq "shows ●2" "●2" "$out"
}

test_status_working_not_attention() {
  echo "test: status doesn't count working as needs-attention"
  local dir
  dir=$(make_project "oscar")
  cd "$dir"
  "$TEND" init
  "$TEND" emit working "building"
  local out
  out=$("$TEND" status)
  assert_eq "working is ○" "○" "$out"
}

test_board_shows_projects() {
  echo "test: board shows tended projects"
  local dir
  dir=$(make_project "papa")
  cd "$dir"
  "$TEND" init
  "$TEND" emit working "coding"
  local out
  out=$("$TEND")
  assert_contains "shows project name" "papa" "$out"
  assert_contains "shows working state" "agent working" "$out"
  assert_contains "shows message" "coding" "$out"
}

test_board_empty() {
  echo "test: board shows message when no projects"
  # Fresh HOME with no registry
  local out
  out=$("$TEND")
  assert_contains "shows no projects" "No tended projects" "$out"
}

test_board_staleness() {
  echo "test: board marks stale working as unknown"
  local dir
  dir=$(make_project "quebec")
  cd "$dir"
  "$TEND" init
  # Write a stale event (1 hour ago)
  local stale_ts
  stale_ts=$(date -v-1H +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -d "1 hour ago" +"%Y-%m-%dT%H:%M:%S")
  echo "$stale_ts working old task" > "$dir/.tend/events"
  local out
  out=$("$TEND")
  assert_contains "shows unknown for stale" "unknown" "$out"
}

test_detail_view() {
  echo "test: project detail view"
  local dir
  dir=$(make_project "romeo")
  cd "$dir"
  "$TEND" init
  "$TEND" emit working "building feature"
  "$TEND" todo "add tests"
  "$TEND" note "API returns strings not ints"
  local out
  out=$("$TEND" romeo)
  assert_contains "shows project name" "ROMEO" "$out"
  assert_contains "shows current task" "building feature" "$out"
  assert_contains "shows TODO" "add tests" "$out"
  assert_contains "shows notes" "API returns strings" "$out"
}

test_todo_add() {
  echo "test: todo adds items"
  local dir
  dir=$(make_project "tango")
  cd "$dir"
  "$TEND" init
  local out
  out=$("$TEND" todo "refactor model layer")
  assert_contains "confirms added" "Added to tango/TODO" "$out"
  local content
  content=$(cat "$dir/.tend/TODO")
  assert_contains "item in file" "refactor model layer" "$content"
}

test_todo_show() {
  echo "test: todo shows items when no message"
  local dir
  dir=$(make_project "uniform")
  cd "$dir"
  "$TEND" init
  "$TEND" todo "item one"
  "$TEND" todo "item two"
  local out
  out=$("$TEND" todo uniform)
  assert_contains "shows first item" "item one" "$out"
  assert_contains "shows second item" "item two" "$out"
}

test_done_logs() {
  echo "test: done logs completion"
  local dir
  dir=$(make_project "victor")
  cd "$dir"
  "$TEND" init
  local out
  out=$("$TEND" done "shipped v2.1")
  assert_contains "confirms logged" "Logged to victor/DONE" "$out"
  local content
  content=$(cat "$dir/.tend/DONE")
  assert_contains "item in file" "shipped v2.1" "$content"
}

test_note_captures() {
  echo "test: note captures context"
  local dir
  dir=$(make_project "whiskey")
  cd "$dir"
  "$TEND" init
  local out
  out=$("$TEND" note "old API uses string dates")
  assert_contains "confirms added" "Added to whiskey/NOTES" "$out"
  local content
  content=$(cat "$dir/.tend/NOTES")
  assert_contains "note in file" "old API uses string dates" "$content"
}

test_sync_generates_prompt() {
  echo "test: sync generates reconciliation prompt"
  local dir
  dir=$(make_project "xray")
  cd "$dir"
  "$TEND" init
  "$TEND" todo "build feature X"
  "$TEND" done "fixed bug Y"
  local out
  out=$("$TEND" sync xray)
  assert_contains "has project name" "xray" "$out"
  assert_contains "has TODO section" "Current TODO" "$out"
  assert_contains "has DONE section" "Completed" "$out"
  assert_contains "has git section" "Git History" "$out"
  assert_contains "has instructions" "Instructions" "$out"
}

test_unknown_command() {
  echo "test: unknown command shows error"
  local out
  out=$("$TEND" nonexistent 2>&1) || true
  assert_contains "shows error" "unknown command" "$out"
}

test_nested_project() {
  echo "test: nested project discovery via registry"
  local parent="$TEST_DIR/parent"
  local nested="$parent/child/grandchild"
  make_project "grandchild" "$nested" >/dev/null
  cd "$nested"
  "$TEND" init
  local out
  out=$("$TEND")
  assert_contains "nested project on board" "grandchild" "$out"
}

test_project_name_resolution() {
  echo "test: project name resolution (prefix/substring)"
  local dir
  dir=$(make_project "my-cool-app")
  cd "$dir"
  "$TEND" init
  "$TEND" emit working "coding"

  # Exact match
  local out
  out=$("$TEND" my-cool-app)
  assert_contains "exact match works" "MY-COOL-APP" "$out"

  # Prefix match
  out=$("$TEND" my-cool)
  assert_contains "prefix match works" "MY-COOL-APP" "$out"

  # Substring match
  out=$("$TEND" cool-app)
  assert_contains "substring match works" "MY-COOL-APP" "$out"
}

# ─── Runner ──────────────────────────────────────────────────────────────────

run_all() {
  echo ""
  echo "Tend CLI Test Suite"
  echo "==================="
  echo ""

  local tests=(
    test_version
    test_help
    test_init_creates_tend_dir
    test_init_creates_agents_md
    test_init_appends_to_existing_agents_md
    test_init_idempotent_agents_md
    test_init_registers_project
    test_init_registry_idempotent
    test_init_shell_integration
    test_init_shell_idempotent
    test_emit_valid_states
    test_emit_invalid_state
    test_emit_requires_init
    test_status_no_attention
    test_status_needs_attention
    test_status_working_not_attention
    test_board_shows_projects
    test_board_empty
    test_board_staleness
    test_detail_view
    test_todo_add
    test_todo_show
    test_done_logs
    test_note_captures
    test_sync_generates_prompt
    test_unknown_command
    test_nested_project
    test_project_name_resolution
  )

  for t in "${tests[@]}"; do
    setup
    $t
    teardown
    echo ""
  done

  echo "==================="
  echo "Results: $PASS passed, $FAIL failed"
  echo ""

  if (( FAIL > 0 )); then
    exit 1
  fi
}

run_all
