#!/usr/bin/env bash
# Test assertion helpers for the claude-grammar test suite.

set -u

if [[ -t 1 ]]; then
  T_RED=$'\033[31m'; T_GRN=$'\033[32m'; T_RST=$'\033[0m'
else
  T_RED=''; T_GRN=''; T_RST=''
fi

assert_equal() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    printf '  %s✓%s %s\n' "$T_GRN" "$T_RST" "$label"
    return 0
  fi
  printf '  %s✗%s %s\n' "$T_RED" "$T_RST" "$label"
  printf '      expected: [%s]\n' "$expected"
  printf '      actual:   [%s]\n' "$actual"
  return 1
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    printf '  %s✓%s %s\n' "$T_GRN" "$T_RST" "$label"
    return 0
  fi
  printf '  %s✗%s %s\n' "$T_RED" "$T_RST" "$label"
  printf '      haystack: [%s]\n' "$haystack"
  printf '      needle:   [%s]\n' "$needle"
  return 1
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    printf '  %s✓%s %s\n' "$T_GRN" "$T_RST" "$label"
    return 0
  fi
  printf '  %s✗%s %s\n' "$T_RED" "$T_RST" "$label"
  printf '      haystack: [%s]\n' "$haystack"
  printf '      forbidden needle: [%s]\n' "$needle"
  return 1
}

assert_empty() {
  local label="$1" value="$2"
  if [[ -z "$value" ]]; then
    printf '  %s✓%s %s\n' "$T_GRN" "$T_RST" "$label"
    return 0
  fi
  printf '  %s✗%s %s\n' "$T_RED" "$T_RST" "$label"
  printf '      expected empty, got: [%s]\n' "$value"
  return 1
}

# Strip ANSI escape sequences from a string.
strip_ansi() {
  printf '%s' "$1" | sed -E $'s/\x1B\\[[0-9;]*m//g'
}

# Per-session output file the hook writes to.
output_file() {
  local session="${1:-test-session}"
  printf '/tmp/grammar-%s.txt' "$session"
}

# Reset the output file for a session.
reset_output() {
  rm -f "$(output_file "${1:-test-session}")"
}

# Build the JSON event Claude Code passes on stdin to a UserPromptSubmit hook.
hook_event_json() {
  local prompt="$1" session="${2:-test-session}"
  jq -nc --arg p "$prompt" --arg s "$session" '
    {
      session_id: $s,
      transcript_path: "/tmp/fake-transcript.jsonl",
      cwd: "/tmp",
      hook_event_name: "UserPromptSubmit",
      prompt: $p
    }
  '
}

# Run grammar-check.sh with the given prompt. Resets the output file
# before running, then echoes its contents with ANSI escapes stripped.
run_check() {
  local prompt="$1" session="${2:-test-session}"
  reset_output "$session"
  hook_event_json "$prompt" "$session" | bash "$REPO_ROOT/scripts/grammar-check.sh"
  strip_ansi "$(cat "$(output_file "$session")" 2>/dev/null)"
}

# Run grammar-status.sh for the given session. Returns its stdout with
# ANSI escapes stripped for clean asserts on the badge prefix.
run_status() {
  local session="${1:-test-session}"
  local raw
  raw=$(jq -nc --arg s "$session" '{ session_id: $s }' \
    | bash "$REPO_ROOT/scripts/grammar-status.sh")
  strip_ansi "$raw"
}
