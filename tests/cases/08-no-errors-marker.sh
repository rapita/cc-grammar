#!/usr/bin/env bash
# Explicit NO_ERRORS marker from the LLM → empty output file.
# (Distinct from "clean text" — this verifies the marker path itself.)

set -u
. "$TESTS_DIR/lib/assert.sh"

out=$(run_check "trigger via __FORCE_NO_ERRORS__ marker for the mock claude" "t08-no-errors")

fails=0
assert_empty "NO_ERRORS marker → empty file" "$out" || fails=$((fails+1))
exit "$fails"
