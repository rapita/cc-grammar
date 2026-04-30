#!/usr/bin/env bash
# Inputs starting with `/` skip the LLM and clear the output file (so any
# stale corrections from the previous prompt are dropped).

set -u
. "$TESTS_DIR/lib/assert.sh"

# Pre-seed the file with stale content; the gate should clear it.
session="t02-slash"
printf 'stale content\n' > "$(output_file "$session")"

out=$(run_check "/some-command with arguments here that contain i has and he go" "$session")

fails=0
assert_empty "slash command cleared the output file" "$out" || fails=$((fails+1))
exit "$fails"
