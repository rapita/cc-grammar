# Contributing to cc-grammar

How the mod works, how to run it from source, how to test it, and how it is released.

## How it works

cc-grammar is a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview): `hooks/hooks.json` names one hooks module, `hooks/register.tsx`, which Claude Code runs in its own process. It never adds context to the conversation, holds a call, submits, or writes a file.

- **The terminal alone.** `session.start` reads `isInteractive`: true in the terminal, where Claude Code draws its own prompt box; false in the desktop app, VS Code and a `-p` run, which are SDK hosts. Outside the terminal every hook passes the event on at once and the command `english` is not registered, so nothing goes to Haiku, no timer starts and nothing is drawn. See [The desktop app, later](#the-desktop-app-later).
- **`prompt.edit`** sees every edit of the draft. There is no `prompt.change` hook: Claude Code 2.1.299, which the desktop app runs, does not have that event and refuses a module that hooks it, and the mod should load there cleanly to stay idle. After a pause (`$.clock.after`), the person's own words go to Haiku through `$.model.complete`, and the English comes back as gray `virtualText` after the draft. With the cursor at the end, a same-text `$.prompt.fill` attaches it at once; with the cursor elsewhere, a fill would move the cursor, so the next edit's answer draws it.
- **The command `english`** (immediate) is what the person binds a key to. It takes the English into the box, gives the words back, or translates at once when no English is shown yet. In an empty box it takes Claude Code's own suggestion (seen through `prompt.suggest`); this is covered by a test, not seen live, because the suggestion never showed in test sessions.
- **Shell mode** (`!`) is not in the prompt events. The hint row's text tells it (`! for shell mode`), read in a `PromptHint` render hook; a fill in that mode would switch the box back to a prompt, so nothing is filled or offered there.
- **`prompt.submit`**: a message typed at the composer whose English the person did not see gets the ✎ line: its English, or v1's grammar check ordered by CEFR level. The check reads the box as it was last seen when that is the message sent (`isSentAs`), so a long paste counts as its placeholder; a box changed with no edit, such as a history recall, is checked as sent. A `UserMessage` render hook draws the line under the message.
- **`hooks/english.ts`** holds the pure parts: what qualifies (three or more of the person's own words, short, no paste; a short reply to a plan's options, such as `go 2`, never), the prompts, and the check on what comes back. Code, paths, numbers, capitals, @-mentions and quoted literals must survive verbatim; outside them the English may hold at most a fifth of its letters from another script, so a name such as Zürich survives; and a reply far shorter than its words is taken for one cut short. Any of these fails, and nothing is shown. Answers under several quote lines go as numbered parts and come back in place.

## The desktop app, later

The point of cc-grammar is the English at the draft, before Enter, taken with one key. In the Code tab of the Claude desktop app that cannot be done yet, so the mod stays idle there. Seen on 2026-10-16 with the desktop app 2.42304.0, which runs Claude Code 2.1.299, through probe mods that logged each event to a file:

- **What reaches a mod there.** `session.start` with `isInteractive` false and `$.session.surfaces()` `["desktop"]`. `prompt.edit` on every key, origin `composer`, with the draft and the cursor. `prompt.submit` with origin `composer`, while the `UserMessage` row is drawn with origin `sdk`. A line drawn under a message shows there, once Haiku has answered and the row is drawn again.
- **What stops it.**
  - The gray English: `PromptDecoration.virtualText` is "not drawn ... by a remote host" (Claude Code 2.1.301 types), and the desktop app is one.
  - The key: `keybindings.json` binds keys in the terminal.
  - The band above the prompt (`AbovePrompt`): the app asked for it only while a turn ran (`isWorking` true), though the [docs](https://code.claude.com/docs/en/plugins/mods/interface) say it is always there.
  - A pane would show the English, but far from the draft; that is not wanted.
- **What would bring it.** The app drawing `virtualText` in its box, or the band while no turn runs. Then the English can show there with a button that takes it into the box through `$.prompt.fill`; the app says it answers `ui_prompt_fill`, which was not tried.
- **To look again.** Load a probe in a desktop session (hot reloading of the mods folder) that logs `session.start`, `prompt.edit` and each `ui.render` of `AbovePrompt` with its `isWorking`, type with no turn running, and read the log.

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
- `tests/render.test.tsx` submits a message to a test engine whose Haiku answers are fixed, and checks the ✎ line drawn under it; outside the terminal, that neither typing nor sending reaches Haiku and nothing is drawn.
- `tests/keys.test.tsx` checks the key with Claude Code's own suggestion and in shell mode.

## Releases

Commits on main follow [Conventional Commits](https://www.conventionalcommits.org): `feat:` for what a person notices, `fix:` for a bug, `feat!:` for a change that breaks an install or a setting, and `docs:`, `test:`, `ci:` and `chore:` for the rest. [release-please](https://github.com/googleapis/release-please) keeps a release pull request open from them. Merging it is the release: the version in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and `.release-please-manifest.json`, `CHANGELOG.md`, the tag `vX.Y.Z` and the GitHub release. Never set the version by hand. Then update the install:

```bash
claude plugin marketplace update rapita-cc-grammar
claude plugin update cc-grammar@rapita-cc-grammar
```

## Layout

```
.
├── .claude-plugin/
│   ├── plugin.json           # manifest and the /config rows
│   └── marketplace.json      # marketplace listing, and the rename of v1
├── .github/workflows/
│   └── release.yml           # release-please on each push to main
├── hooks/
│   ├── hooks.json            # names the hooks module
│   ├── register.tsx          # the hooks
│   └── english.ts            # pure parts: what qualifies, prompts, checks
├── tests/
│   ├── english.test.ts
│   ├── keys.test.tsx
│   └── render.test.tsx
├── tsconfig.json             # extends the generated one
├── release-please-config.json
├── .release-please-manifest.json
├── CHANGELOG.md
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```
