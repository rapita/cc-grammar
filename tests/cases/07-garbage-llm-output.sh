#!/usr/bin/env bash
# When the LLM ignores the contract and returns prose, the strict format
# filter must drop everything and the output file must be empty.

set -u
. "$TESTS_DIR/lib/assert.sh"

out=$(run_check "trigger via __FORCE_GARBAGE__ marker for the mock claude" "t07-garbage")

fails=0
assert_empty "garbage LLM output → empty file" "$out" || fails=$((fails+1))
exit "$fails"
