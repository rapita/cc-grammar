#!/usr/bin/env bash
# Inputs <10 chars are skipped (the ${#prompt} -lt 10 gate) and the
# output file is cleared.

set -u
. "$TESTS_DIR/lib/assert.sh"

session="t03-short"
printf 'stale content\n' > "$(output_file "$session")"

out=$(run_check "i has" "$session")

fails=0
assert_empty "short prompt cleared the output file" "$out" || fails=$((fails+1))
exit "$fails"
