#!/usr/bin/env bash
# UserPromptSubmit hook (async) for the claude-grammar plugin.
#
# Runs a grammar check on the user's prompt and writes up to 3 ANSI-colored
# suggestions to /tmp/grammar-<session>.txt. The file is read by the user's
# statusline tool (ccstatusline, native Claude Code statusLine, tmux, etc.),
# never by Claude itself — so suggestions stay out of the model's context.
#
# Configured with `"async": true` in hooks/hooks.json so the user's prompt
# submits without waiting; the hook-level `timeout` is the upper bound.

set -u

# shellcheck source=grammar.sh
. "$(cd "$(dirname "$0")" && pwd)/grammar.sh"

# Recursion guard: `claude -p` itself triggers another UserPromptSubmit
# event. When GRAMMAR_RUNNING=1 is set we're inside that sub-call; bail
# out and leave the existing file alone.
[[ -n "${GRAMMAR_RUNNING:-}" ]] && exit 0

input=$(cat)
prompt=$(printf '%s' "$input" | jq -r '.prompt // ""')
session=$(printf '%s' "$input" | jq -r '.session_id // "default"')
out_file="/tmp/grammar-${session}.txt"

# Best-effort cleanup of stale per-session files older than a day.
find /tmp -maxdepth 1 -name 'grammar-*.txt' -mtime +1 -delete 2>/dev/null

# Gates: clear the file (drops stale corrections from the previous prompt)
# and exit. The empty file tells the statusline tool "nothing to show".
[[ -z "$prompt" ]]      && { : > "$out_file"; exit 0; }
[[ "$prompt" == /* ]]   && { : > "$out_file"; exit 0; }
[[ ${#prompt} -lt 10 ]] && { : > "$out_file"; exit 0; }

CLAUDE_BIN=$(discover_claude_bin)
[[ -z "$CLAUDE_BIN" ]] && exit 0

SYS=$(grammar_system_prompt)

# Run from /tmp so `claude -p` does not auto-load the project's CLAUDE.md
# or .claude/ configuration. The minimization flags trim startup overhead:
#   --tools ""                              no built-in tools (text in, text out)
#   --disable-slash-commands                no skill loading
#   --strict-mcp-config --mcp-config '...'  no MCP servers
#   --no-session-persistence                don't save this throwaway session
result=$(cd /tmp && GRAMMAR_RUNNING=1 "$CLAUDE_BIN" -p \
  --system-prompt "$SYS" --model haiku \
  --tools "" \
  --disable-slash-commands \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --no-session-persistence \
  <<< "<text>
$prompt
</text>" | tr -d '\r')

if [[ -z "$result" || "$result" =~ NO_ERRORS ]]; then
  : > "$out_file"
  exit 0
fi

formatted=$(printf '%s' "$result" | grammar_format_suggestions)
if [[ -z "$formatted" ]]; then
  : > "$out_file"
  exit 0
fi

printf '%s\n' "$formatted" > "$out_file"
