#!/usr/bin/env bash
# When the LLM emits 5 suggestions, only the first 3 should make it
# through the formatter (matches the system prompt's "up to 3" contract).

set -u
. "$TESTS_DIR/lib/assert.sh"

out=$(run_check "trigger via __FORCE_TOO_MANY__ marker for the mock claude" "t06-many")

fails=0

# Count " · " separators -> N+1 suggestions total.
seps=$(printf '%s' "$out" | awk -F' · ' '{print NF-1}')
count=$((seps + 1))
assert_equal "exactly 3 suggestions kept" "3" "$count" || fails=$((fails+1))
assert_contains "kept first (a -> b)"   "$out" "a -> b" || fails=$((fails+1))
assert_contains "kept third (e -> f)"   "$out" "e -> f" || fails=$((fails+1))
assert_not_contains "dropped fourth (g -> h)" "$out" "g -> h" || fails=$((fails+1))

exit "$fails"
