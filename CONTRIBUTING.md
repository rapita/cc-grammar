# Contributing to claude-grammar

This file covers the bits a user doesn't need: how the plugin works internally, how to install from source, what to change if you're hacking on it, and how to run and extend the tests.

## How it works

A single `UserPromptSubmit` hook configured with `"async": true` (a [native Claude Code feature](https://code.claude.com/docs/en/hooks)):

1. The hook fires when you submit a prompt. With `async: true`, **the hook runs in the background while your prompt submits and Claude starts responding** — zero added latency.
2. `scripts/grammar-check.sh` pipes your message through `claude -p` with a tight system prompt asking for up to 3 issues.
3. When the script exits, it has written the formatted corrections to `/tmp/grammar-<session>.txt` (or emptied it, if no relevant errors).
4. Your statusline tool reads that file and renders it.

`claude -p` is run from `/tmp` so it doesn't auto-load the project's `CLAUDE.md` or `.claude/` configuration; otherwise the grammar check would inherit your project context. A `GRAMMAR_RUNNING=1` env var serves as a recursion guard, since `claude -p` itself triggers another `UserPromptSubmit` event.

### Why a file, and not `systemMessage` or `additionalContext`?

`additionalContext` would inject the suggestions into the conversation, costing tokens every turn and risking off-topic responses. The plugin avoids it precisely because it would pollute context.

`systemMessage` is documented as UI-only (shown to the user, not added to the model's context). In practice, however, on Claude Code 2.1.123 the `systemMessage` field emitted from an `async: true` hook lands in the model's context as a `<system-reminder>` rather than rendering in the UI — exactly what the plugin promises to avoid. Writing to a file owned end-to-end by the plugin sidesteps that entire codepath: the suggestions go straight to disk, your statusline tool reads them, and Claude never sees a thing.

We also do **not** use `asyncRewake: true`. That field is designed to wake Claude with the hook's stderr/stdout on exit code 2 (long-running background failures), and the wake message lands in the model's context — exactly the path we want to avoid.

## Install from source

Clone the repo anywhere on disk, then register that folder with Claude Code as a local marketplace:

```bash
git clone https://github.com/rapita/claude-grammar /path/to/claude-grammar
claude plugin marketplace add /path/to/claude-grammar
claude plugin install claude-grammar@rapita-claude-grammar
```

This uses the same plugin system as the marketplace install — the only difference is that the marketplace source is your local clone, so any edits you make to the scripts take effect after `claude plugin uninstall && claude plugin install` (the cache is keyed by version).

## Tweaks (require source install)

These edits modify the plugin's source. If you installed from the marketplace, the cache will overwrite your changes on update — install from source first.

- **Different model** — change `--model haiku` in `scripts/grammar-check.sh` to `--model sonnet` or any model id. Better quality, more cost.
- **Non-Anthropic LLM** — replace the `claude -p ...` block with a `curl` to your local LLM (Ollama, llama.cpp, etc.) — anything that takes stdin and prints suggestions in `"original" -> "fix"` format.
- **Skip more short messages** — bump the `${#prompt} -lt 10` threshold higher.
- **Adjust the priority order** — edit the numbered list in `grammar_system_prompt()` inside `scripts/grammar.sh`.
- **Different output path** — edit the `out_file=...` line in `scripts/grammar-check.sh` (and update your statusline wiring to match).

## Tests

The plugin ships with a bash test suite that doesn't call the real `claude` CLI — it uses a [mock](./tests/mocks/claude) keyed off input markers.

```bash
./tests/run.sh           # run all cases
./tests/run.sh 02 03     # run cases matching "02" or "03"
```

Coverage:

| # | Case | What it verifies |
|---|------|-----------------|
| 01 | `happy-path` | Prompt with errors → output file contains both fixes joined by ` · ` |
| 02 | `slash-command-skipped` | Inputs starting with `/` clear the output file (no LLM call) |
| 03 | `short-message-skipped` | Inputs <10 chars clear the output file (no LLM call) |
| 04 | `recursion-guard` | `GRAMMAR_RUNNING=1` exits before touching the file |
| 06 | `too-many-suggestions` | LLM returning 5 lines is truncated to 3 |
| 07 | `garbage-llm-output` | Off-format LLM output is filtered → empty file |
| 08 | `no-errors-marker` | Explicit `NO_ERRORS` → empty file |
| 09 | `status-empty` | `grammar-status.sh`: missing/empty file → no widget output |
| 10 | `status-single` | `grammar-status.sh`: one correction → `EN ` prefix |
| 11 | `status-multiple` | `grammar-status.sh`: three corrections → `EN(3) ` prefix |

### Adding a case

Drop a new `tests/cases/NN-name.sh`. Available helpers (sourced from `$TESTS_DIR/lib/assert.sh`):

- `run_check PROMPT [SESSION]` — reset the per-session output file, pipe a UserPromptSubmit JSON to `grammar-check.sh`, return the file's contents
- `run_status [SESSION]` — pipe a session-id JSON to `grammar-status.sh`, return its stdout
- `output_file [SESSION]` — return the per-session output file path
- `reset_output [SESSION]` — `rm -f` the per-session output file
- `hook_event_json PROMPT [SESSION]` — build the JSON Claude Code passes on stdin
- `strip_ansi STRING` — strip ANSI escape sequences (`run_check` and `run_status` already pipe through this before returning, so assertions can ignore color)
- `assert_equal LABEL EXPECTED ACTUAL`
- `assert_contains LABEL HAYSTACK NEEDLE`
- `assert_not_contains LABEL HAYSTACK NEEDLE`
- `assert_empty LABEL VALUE`

To force a particular response from the mock claude, include one of these markers in the prompt: `__FORCE_NO_ERRORS__`, `__FORCE_GARBAGE__`, `__FORCE_TOO_MANY__`. See [`tests/mocks/claude`](./tests/mocks/claude) for details.

## Debugging

The hook is async, so any errors it emits go to Claude Code's own hook logs rather than your terminal. You can run the script manually to see what it does:

```bash
echo '{"prompt":"i has a cat","session_id":"manual-test"}' | bash scripts/grammar-check.sh
cat /tmp/grammar-manual-test.txt
```

The session log under `~/.claude/projects/<cwd>/<session>.jsonl` records every async hook firing with `stdout`, `stderr`, and `exitCode` — grep for `"hookEventName":"UserPromptSubmit"` to verify the hook ran at all.

Common issues:

- **`Not logged in · Please run /login`** → don't strip Claude's auth env. Hooks inherit the user environment by default; if you've added `env -i` somewhere, remove it.
- **Suggestions about Claude's response, not your input** → `claude -p` is loading project context. The `cd /tmp` in the hook prevents this; if you removed it, restore it.
- **`claude -p` hangs** → Claude Code kills the script after the hook-level `timeout` in `hooks/hooks.json` (default 120s). Lower the timeout if you'd prefer faster recovery.
- **Output file is empty when you expect suggestions** → empty file = LLM returned `NO_ERRORS` or off-contract output that the strict format filter dropped.
- **Statusline doesn't update** → that's a wiring issue, not a plugin issue. Confirm the file changes when you submit a prompt, then check that your statusline tool is reading the same path.

## Layout

```
.
├── .claude-plugin/
│   ├── plugin.json           # plugin manifest
│   └── marketplace.json      # marketplace listing
├── commands/
│   └── setup.md              # /claude-grammar:setup slash command
├── hooks/
│   └── hooks.json            # single async UserPromptSubmit hook
├── scripts/
│   ├── grammar-check.sh      # the hook script (does the check, writes the file)
│   ├── grammar-status.sh     # statusline widget (reads the file, renders with badge)
│   ├── grammar.sh            # shared helpers (system prompt, format, discovery)
│   └── setup.sh              # idempotent setup driver behind /claude-grammar:setup
├── tests/
│   ├── run.sh                # entry point
│   ├── lib/assert.sh         # assertion helpers
│   ├── mocks/claude          # fake `claude` binary
│   └── cases/                # 10 test cases
├── README.md                 # user-facing docs
└── CONTRIBUTING.md           # this file
```
