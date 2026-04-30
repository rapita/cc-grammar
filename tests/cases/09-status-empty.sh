#!/usr/bin/env bash
# grammar-status.sh: when the per-session file is missing or empty,
# the widget emits nothing (so an unset state takes no statusline space).

set -u
. "$TESTS_DIR/lib/assert.sh"

session="t09-status-empty"
reset_output "$session"

out=$(run_status "$session")

fails=0
assert_empty "no file → no widget output" "$out" || fails=$((fails+1))

# Also: file exists but is zero-length → still no output.
: > "$(output_file "$session")"
out=$(run_status "$session")
assert_empty "empty file → no widget output" "$out" || fails=$((fails+1))

exit "$fails"
