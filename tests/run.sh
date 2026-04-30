#!/usr/bin/env bash
# Test runner for the claude-grammar plugin.
#
# Discovers every executable case file in tests/cases/, runs each in a
# subshell with the mock `claude`, and prints a pass/fail summary.
#
# Usage:
#   ./tests/run.sh            # run all cases
#   ./tests/run.sh 02 05      # run only matching cases (substring on filename)

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TESTS_DIR="$REPO_ROOT/tests"
CASES_DIR="$TESTS_DIR/cases"
MOCK_CLAUDE="$TESTS_DIR/mocks/claude"

[[ -x "$MOCK_CLAUDE" ]] || chmod +x "$MOCK_CLAUDE"

if [[ -t 1 ]]; then
  T_GRN=$'\033[32m'; T_RED=$'\033[31m'; T_BLD=$'\033[1m'; T_RST=$'\033[0m'
else
  T_GRN=''; T_RED=''; T_BLD=''; T_RST=''
fi

shopt -s nullglob
all_cases=( "$CASES_DIR"/*.sh )
shopt -u nullglob
[[ ${#all_cases[@]} -eq 0 ]] && { printf 'FATAL: no test cases in %s\n' "$CASES_DIR" >&2; exit 2; }

selected=()
if [[ $# -eq 0 ]]; then
  selected=( "${all_cases[@]}" )
else
  for c in "${all_cases[@]}"; do
    base=$(basename "$c")
    for needle in "$@"; do
      [[ "$base" == *"$needle"* ]] && { selected+=( "$c" ); break; }
    done
  done
fi
[[ ${#selected[@]} -eq 0 ]] && { printf 'No test cases matched: %s\n' "$*" >&2; exit 2; }

pass=0; fail=0; failed_names=()

for case_path in "${selected[@]}"; do
  name=$(basename "$case_path" .sh)
  printf '%s%s%s\n' "$T_BLD" "$name" "$T_RST"

  if (
    set -e
    export REPO_ROOT TESTS_DIR
    export GRAMMAR_CLAUDE_BIN="$MOCK_CLAUDE"
    export CLAUDE_PLUGIN_ROOT="$REPO_ROOT"
    # Belt-and-suspenders: don't let a sub-`claude` call see real config.
    export CLAUDE_CONFIG_DIR="/tmp/claude-grammar-test-config"
    bash "$case_path"
  ); then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    failed_names+=( "$name" )
  fi
  printf '\n'
done

total=$((pass + fail))
if [[ $fail -eq 0 ]]; then
  printf '%s%s%d/%d passing%s\n' "$T_BLD" "$T_GRN" "$pass" "$total" "$T_RST"
  exit 0
else
  printf '%s%s%d/%d passing, %d failing%s\n' "$T_BLD" "$T_RED" "$pass" "$total" "$fail" "$T_RST"
  for n in "${failed_names[@]}"; do
    printf '  %s✗%s %s\n' "$T_RED" "$T_RST" "$n"
  done
  exit 1
fi
