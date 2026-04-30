# claude-grammar

Background English grammar coach for [Claude Code](https://docs.claude.com/en/docs/claude-code), packaged as a native plugin. Runs on every prompt you submit, finds up to 3 grammar issues (ordered A1 → C1+ by CEFR level), and shows them in your statusline — never in Claude's context.

Claude Code-native: a single `UserPromptSubmit` hook, plain bash, no third-party services. The bundled `/claude-grammar:setup` command wires it into your statusline (ccstatusline, native `statusLine`, or a custom script).

## What it looks like

Type a message with errors, hit enter — your prompt submits immediately. ~1–2 seconds later, the corrections appear in your statusline as a tree:

```
EN(2)
├ i has → I have
└ he go → he goes
```

Originals are colored red, fixes green; the badge and tree glyphs are dim. Suggestions go from lower to higher CEFR level (A1 → C1+). When your message is fine, the statusline stays clean.

**Corrections are written for you, not for Claude.** They live in a per-session file under `/tmp/`, never enter the model's context window, and won't influence its next response.

## Install

```bash
claude plugin marketplace add rapita/claude-grammar
claude plugin install claude-grammar@rapita-claude-grammar
```

Then run the setup command in Claude Code:

```
/claude-grammar:setup
```

It copies the statusline widget into `~/.claude/grammar-status.sh` and wires it into whatever statusline you already use. Re-run any time — it's idempotent and creates timestamped backups before any write.

Restart Claude Code, and the next message you submit will be checked.

## Prerequisites

- macOS or Linux
- [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and authenticated
- `jq` (`brew install jq` / `apt install jq`)
- A statusline tool — the setup command can wire [ccstatusline](https://github.com/sirmalloc/ccstatusline) or Claude Code's native `statusLine` for you

## Cost

A `claude -p` call with Haiku fires on every prompt that passes the gates (non-empty, doesn't start with `/`, ≥10 chars). A few hundred input tokens and ~50 output tokens per check — negligible on the Pro/Team plans.

## Troubleshooting

- **Nothing shows in the statusline** → run `/claude-grammar:setup` again. It'll detect what's missing and either fix it or print exact instructions. If it reports everything is wired, restart Claude Code.
- **`Not logged in · Please run /login`** → the hook uses the same auth as your shell `claude`. If something is stripping Claude's environment, restore it.
- **Want to silence it temporarily** → `claude plugin disable claude-grammar@rapita-claude-grammar` (re-enable with `enable`).

## License

MIT. See [CONTRIBUTING.md](./CONTRIBUTING.md) for design rationale, source install, tests, and everything else you'd touch when hacking on the plugin.
