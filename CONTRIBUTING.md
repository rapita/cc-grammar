# Contributing to cc-grammar

How the mod works, how to run it from source, and how to test it.

## How it works

cc-grammar is a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview): `hooks/hooks.json` names one hooks module, `hooks/register.tsx`, which Claude Code runs in its own process. It never adds context to the conversation, holds a call, submits, or writes a file.

- **`prompt.edit`** sees every edit of the draft, and **`prompt.change`** every change no edit carried (a history recall, a clear). After a pause (`$.clock.after`), the person's own words go to Haiku through `$.model.complete`, and the English comes back as gray `virtualText` after the draft. With the cursor at the end, a same-text `$.prompt.fill` attaches it at once; with the cursor elsewhere, a fill would move the cursor, so the next edit's answer draws it.
- **The command `english`** (immediate) is what the person binds a key to. It takes the English into the box, gives the words back, or translates at once when no English is shown yet. In an empty box it takes Claude Code's own suggestion (seen through `prompt.suggest`); this is covered by a test, not seen live, because the suggestion never showed in test sessions.
- **Shell mode** (`!`) is not in the prompt events. The hint row's text tells it (`! for shell mode`), read in a `PromptHint` render hook; a fill in that mode would switch the box back to a prompt, so nothing is filled or offered there.
- **`prompt.submit`**: a message typed at the composer whose English the person did not see gets the ✎ line, decided from the box as it was last seen, so a long paste counts as its placeholder: its English, or v1's grammar check ordered by CEFR level. A `UserMessage` render hook draws it under the message.
- **`hooks/english.ts`** holds the pure parts: what qualifies (three or more of the person's own words, short, no paste; a short reply to a plan's options, such as `go 2`, never), the prompts, and the check on what comes back. Code, paths, numbers, capitals, @-mentions and quoted literals must survive verbatim; outside them the English may hold at most a fifth of its letters from another script, so a name such as Zürich survives; and a reply far shorter than its words is taken for one cut short. Any of these fails, and nothing is shown. Answers under several quote lines go as numbered parts and come back in place.

## Run from source

```bash
git clone https://github.com/rapita/cc-grammar
claude --plugin-dir ./cc-grammar
```

Claude Code writes the type declarations of the running build into `.claude-plugin/types/` when it loads the mod from `--plugin-dir`. They are not committed: they belong to your build.

## Tests

```bash
claude plugin test .
claude plugin validate .
npx -p typescript tsc -p .    # after one load from --plugin-dir has written the types
```

- `tests/english.test.ts` covers the pure parts.
- `tests/render.test.tsx` submits a message to a test engine whose Haiku answers are fixed, and checks the ✎ line drawn under it.
- `tests/keys.test.tsx` checks the key with Claude Code's own suggestion and in shell mode.

## Layout

```
.
├── .claude-plugin/
│   ├── plugin.json           # manifest and the /config rows
│   └── marketplace.json      # marketplace listing, and the rename of v1
├── hooks/
│   ├── hooks.json            # names the hooks module
│   ├── register.tsx          # the hooks
│   └── english.ts            # pure parts: what qualifies, prompts, checks
├── tests/
│   ├── english.test.ts
│   ├── keys.test.tsx
│   └── render.test.tsx
├── tsconfig.json             # extends the generated one
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```
