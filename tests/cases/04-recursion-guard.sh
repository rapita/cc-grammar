#!/usr/bin/env bash
# When GRAMMAR_RUNNING=1 is already set, the hook exits before touching
# the output file (so a sub-`claude -p` invocation doesn't blow away the
# user's current correction). Verifies the file is left intact.

set -u
. "$TESTS_DIR/lib/assert.sh"

session="t04-recursion"
out_path=$(output_file "$session")
printf 'preexisting\n' > "$out_path"

hook_event_json "i has a cat and he go to school" "$session" \
  | GRAMMAR_RUNNING=1 bash "$REPO_ROOT/scripts/grammar-check.sh"

contents=$(cat "$out_path")

fails=0
assert_equal "recursion guard left the file untouched" "preexisting" "$contents" \
  || fails=$((fails+1))
exit "$fails"
