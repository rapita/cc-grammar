#!/usr/bin/env bash
# Happy path: a prompt with two A1 errors → output file contains both
# fixes joined by " · ".

set -u
. "$TESTS_DIR/lib/assert.sh"

out=$(run_check "i has a cat and he go to school every morning" "t01-happy")

fails=0
assert_contains "first fix in file"  "$out" "i has -> I have"  || fails=$((fails+1))
assert_contains "second fix in file" "$out" "he go -> he goes" || fails=$((fails+1))
assert_contains "fixes joined by separator" "$out" " · " || fails=$((fails+1))

# The plugin's central promise: nothing goes to stdout (which Claude Code
# would otherwise inject into the model's context).
assert_not_contains "no JSON wrapping" "$out" "systemMessage" || fails=$((fails+1))
assert_not_contains "no JSON wrapping" "$out" "{" || fails=$((fails+1))

exit "$fails"
