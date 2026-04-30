#!/usr/bin/env bash
# grammar-status.sh: one correction → "EN" header (no count) + a single
# leaf line carrying the correction.

set -u
. "$TESTS_DIR/lib/assert.sh"

session="t10-status-single"
printf 'i has -> I have\n' > "$(output_file "$session")"

out=$(run_status "$session")

fails=0
assert_contains "starts with EN header"          "$out" "EN" || fails=$((fails+1))
assert_not_contains "no count for 1 entry"       "$out" "EN(" || fails=$((fails+1))
assert_contains "leaf glyph for single entry"    "$out" "└ i has → I have" || fails=$((fails+1))
assert_not_contains "no branch glyph (1 entry)"  "$out" "├" || fails=$((fails+1))
exit "$fails"
