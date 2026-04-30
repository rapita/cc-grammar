#!/usr/bin/env bash
# grammar-status.sh: 3 corrections → "EN(3)" header + tree-style stack
# (├ branch for non-last, └ for last).

set -u
. "$TESTS_DIR/lib/assert.sh"

session="t11-status-multiple"
printf 'a -> b · c -> d · e -> f\n' > "$(output_file "$session")"

out=$(run_status "$session")

fails=0
assert_contains "EN(3) header"           "$out" "EN(3)" || fails=$((fails+1))
assert_contains "branch for first entry" "$out" "├ a → b" || fails=$((fails+1))
assert_contains "branch for second"      "$out" "├ c → d" || fails=$((fails+1))
assert_contains "leaf for last entry"    "$out" "└ e → f" || fails=$((fails+1))
exit "$fails"
