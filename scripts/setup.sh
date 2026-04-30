#!/usr/bin/env bash
# Idempotent setup for the claude-grammar plugin's statusline widget.
#
# Invoked by the /claude-grammar:setup slash command, or runnable
# directly:
#   bash ${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh
#
# Behavior:
#   1. Copy or update ~/.claude/grammar-status.sh from the plugin (with
#      SHA check; backs up any drifted copy before overwriting).
#   2. Detect ~/.claude/settings.json statusLine and wire it up:
#        - empty/missing  → write `statusLine` block to settings.json
#        - ccstatusline   → add a custom-command segment to its config
#        - custom .sh     → append a marked invocation block to the script
#        - other          → print a snippet, no auto-write
#      All writes back up the target as <file>.bak.<timestamp> first.
#   3. Confirm the plugin itself is enabled.

set -u

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
SRC_SCRIPT="${PLUGIN_ROOT}/scripts/grammar-status.sh"
DEST_DIR="${HOME}/.claude"
DEST_SCRIPT="${DEST_DIR}/grammar-status.sh"
SETTINGS="${DEST_DIR}/settings.json"
PLUGIN_KEY="claude-grammar@rapita-claude-grammar"
TS=$(date +%Y%m%d%H%M%S)
MARKER='# claude-grammar widget — added by /claude-grammar:setup'

if [[ -t 1 ]]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_OK=''; C_WARN=''; C_ERR=''; C_DIM=''; C_RST=''
fi
ok="${C_OK}✓${C_RST}"; warn="${C_WARN}!${C_RST}"; err="${C_ERR}✗${C_RST}"

# ---- helpers --------------------------------------------------------------

backup_file() {  # echoes the backup path
  local f="$1" b="${1}.bak.${TS}"
  cp "$f" "$b"
  printf '%s\n' "$b"
}

# Replace $f atomically with the contents of stdin.
write_atomic() {
  local f="$1" tmp
  tmp=$(mktemp)
  cat > "$tmp"
  mv "$tmp" "$f"
}

new_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then uuidgen | tr 'A-Z' 'a-z'
  elif command -v python3 >/dev/null 2>&1; then python3 -c 'import uuid; print(uuid.uuid4())'
  else printf 'grammar-%s\n' "$TS"
  fi
}

# Tokenize a shell command and echo the first existing .sh file (after ~ expansion).
extract_script_path() {
  local cmd="$1" tok
  for tok in $cmd; do
    tok="${tok/#\~/$HOME}"
    if [[ -f "$tok" && "$tok" == *.sh ]]; then
      printf '%s\n' "$tok"
      return 0
    fi
  done
}

# ---- sanity ---------------------------------------------------------------

if [[ ! -f "$SRC_SCRIPT" ]]; then
  printf '%s plugin script not found: %s\n' "$err" "$SRC_SCRIPT"
  exit 1
fi
mkdir -p "$DEST_DIR"

have_jq=1; command -v jq >/dev/null 2>&1 || have_jq=0

# ---- 1) Copy / update grammar-status.sh ----------------------------------

src_sha=$(shasum -a 256 "$SRC_SCRIPT" | awk '{print $1}')

if [[ -f "$DEST_SCRIPT" ]]; then
  dest_sha=$(shasum -a 256 "$DEST_SCRIPT" | awk '{print $1}')
  if [[ "$src_sha" == "$dest_sha" ]]; then
    printf '%s grammar-status.sh — already up to date (%s)\n' \
      "$ok" "${C_DIM}${DEST_SCRIPT}${C_RST}"
  else
    bak=$(backup_file "$DEST_SCRIPT")
    cp "$SRC_SCRIPT" "$DEST_SCRIPT"
    chmod +x "$DEST_SCRIPT"
    printf '%s grammar-status.sh — drifted; updated\n' "$warn"
    printf '    backup: %s\n' "$bak"
  fi
else
  cp "$SRC_SCRIPT" "$DEST_SCRIPT"
  chmod +x "$DEST_SCRIPT"
  printf '%s grammar-status.sh — copied to %s\n' "$ok" "$DEST_SCRIPT"
fi
echo

# ---- 2) Statusline wiring ------------------------------------------------

write_native_statusline() {
  local bak="" tmp
  if [[ -f "$SETTINGS" ]]; then
    bak=$(backup_file "$SETTINGS")
    tmp=$(jq --arg cmd "$DEST_SCRIPT" \
      '.statusLine = {type: "command", command: $cmd}' "$SETTINGS")
    printf '%s\n' "$tmp" | write_atomic "$SETTINGS"
  else
    printf '{"statusLine":{"type":"command","command":"%s"}}\n' "$DEST_SCRIPT" \
      | jq . | write_atomic "$SETTINGS"
  fi
  printf '%s statusLine — wrote `statusLine` block to %s\n' "$ok" "$SETTINGS"
  [[ -n "$bak" ]] && printf '    backup: %s\n' "$bak"
}

configure_ccstatusline() {
  local cc_dir="${HOME}/.config/ccstatusline"
  local cc_config="${cc_dir}/settings.json"

  if [[ ! -f "$cc_config" ]]; then
    printf '%s ccstatusline — config not found at %s\n' "$warn" "$cc_config"
    printf '    Run %sbunx ccstatusline%s once to create it, then re-run %s/claude-grammar:setup%s.\n' \
      "$C_DIM" "$C_RST" "$C_DIM" "$C_RST"
    return
  fi

  if jq -e --arg p "$DEST_SCRIPT" \
      '[.lines[]?[]? | select(.type=="custom-command" and .commandPath==$p)] | length > 0' \
      "$cc_config" >/dev/null 2>&1; then
    printf '%s ccstatusline — grammar-status segment already configured\n' "$ok"
    printf '    %s%s%s\n' "$C_DIM" "$cc_config" "$C_RST"
    return
  fi

  local bak id tmp
  bak=$(backup_file "$cc_config")
  id=$(new_uuid)
  tmp=$(jq --arg id "$id" --arg p "$DEST_SCRIPT" \
    '.lines += [[{id: $id, type: "custom-command", commandPath: $p, preserveColors: true}]]' \
    "$cc_config")
  printf '%s\n' "$tmp" | write_atomic "$cc_config"
  printf '%s ccstatusline — added grammar-status segment to %s\n' "$ok" "$cc_config"
  printf '    backup: %s\n' "$bak"
}

configure_custom_script() {
  local cmd="$1" script bak
  script=$(extract_script_path "$cmd")
  if [[ -z "$script" ]]; then
    printf '%s statusLine — custom command (no shell script detected):\n' "$warn"
    printf '      %s\n' "$cmd"
    printf '    Add %s to your statusline output yourself.\n' "$DEST_SCRIPT"
    return
  fi

  if grep -qF "grammar-status" "$script" 2>/dev/null; then
    printf '%s statusLine — %s already references grammar-status\n' "$ok" "$script"
    return
  fi

  bak=$(backup_file "$script")
  {
    printf '\n%s\n' "$MARKER"
    printf '"%s"\n' "$DEST_SCRIPT"
  } >> "$script"
  printf '%s statusLine — appended grammar-status invocation to %s\n' "$ok" "$script"
  printf '    backup: %s\n' "$bak"
}

if (( ! have_jq )); then
  printf '%s statusLine — jq not installed; install jq then re-run\n' "$err"
else
  cmd=""
  [[ -f "$SETTINGS" ]] && cmd=$(jq -r '.statusLine.command // ""' "$SETTINGS")

  if [[ -z "$cmd" ]]; then
    write_native_statusline
  elif [[ "$cmd" == *"grammar-status"* ]]; then
    printf '%s statusLine — already points at grammar-status\n' "$ok"
  elif [[ "$cmd" == *"ccstatusline"* ]]; then
    configure_ccstatusline
  else
    configure_custom_script "$cmd"
  fi
fi
echo

# ---- 3) Plugin enabled ----------------------------------------------------

if [[ -f "$SETTINGS" ]] && (( have_jq )); then
  enabled=$(jq -r --arg k "$PLUGIN_KEY" '.enabledPlugins[$k] // false' "$SETTINGS")
  if [[ "$enabled" == "true" ]]; then
    printf '%s plugin %s — enabled\n' "$ok" "$PLUGIN_KEY"
  else
    printf '%s plugin %s — not enabled\n' "$warn" "$PLUGIN_KEY"
    printf '    Run: claude plugin install %s\n' "$PLUGIN_KEY"
  fi
  echo
fi

printf '%sIf you changed plugin code or settings, restart Claude Code to pick them up.%s\n' "$C_DIM" "$C_RST"
