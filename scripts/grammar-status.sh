#!/usr/bin/env bash
# Statusline component for the claude-grammar plugin.
#
# Reads the JSON Claude Code passes to statusLine commands on stdin,
# pulls the session_id, and renders the corrections from
# /tmp/grammar-<session>.txt as a tree:
#
#   EN(2)
#   ├ i has → I have
#   └ he go → he goes
#
# No leading whitespace — statusline tools handle their own padding.
#
# Wire into ~/.claude/settings.json:
#   "statusLine": {
#     "type": "command",
#     "command": "${CLAUDE_PLUGIN_ROOT}/scripts/grammar-status.sh"
#   }

set -u

session=$(jq -r '.session_id // "default"')
out="/tmp/grammar-${session}.txt"
[[ -s "$out" ]] || exit 0

DIM=$'\033[2m'; RST=$'\033[0m'

content=$(cat "$out")
seps=$(printf '%s' "$content" | awk -F' · ' '{print NF-1}')
count=$((seps + 1))

# Header (badge): "EN" for one suggestion, "EN(N)" for multiple.
if [[ $count -le 1 ]]; then
  printf '%sEN%s\n' "$DIM" "$RST"
else
  printf '%sEN(%d)%s\n' "$DIM" "$count" "$RST"
fi

# Suggestions: ├ for non-last, └ for last (always — single-case is just └).
i=1
printf '%s' "$content" | awk -F' · ' '{ for (j=1; j<=NF; j++) print $j }' | while IFS= read -r sub; do
  sub="${sub//-> /→ }"
  if [[ $i -eq $count ]]; then
    printf '%s└%s %s\n' "$DIM" "$RST" "$sub"
  else
    printf '%s├%s %s\n' "$DIM" "$RST" "$sub"
  fi
  i=$((i + 1))
done
