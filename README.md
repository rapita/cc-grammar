# cc-grammar

English while you write prompts in [Claude Code](https://code.claude.com/docs/en/overview). Write in your own language, or in English with mistakes: after a short pause, the English of your draft shows in gray right after it. One key takes it into the prompt, and the same key gives your words back. A message you send without seeing its English gets one gray ✎ line under it: its English, or up to three corrections of your English, simplest first (CEFR A1 → C1+).

All of it is for your eyes only. Nothing enters Claude's context, and nothing is ever sent for you.

## What it looks like

While you type, after a pause:

```
❯ перевір чому падає тест експорту на CI  → Check why the export test is failing on CI
```

Press Tab, and the English is your draft; Tab again gives your words back:

```
❯ Check why the export test is failing on CI
```

A message you sent in English with mistakes:

```
❯ please check why the export test fail on CI but pass locally
  ✎ the export test fail → the export test fails (agreement) · but pass locally → but passes locally (agreement)
```

## Install

```bash
claude plugin marketplace add rapita/cc-grammar
claude plugin install cc-grammar@rapita-cc-grammar
```

cc-grammar is a [mod](https://code.claude.com/docs/en/plugins/mods/overview). It needs Claude Code 2.1.300 or later in the terminal, with mods allowed.

### Bind the key

cc-grammar adds the command `/english`. Bind Tab to it in `~/.claude/keybindings.json` (`/keybindings` opens the file):

```json
{
  "bindings": [
    { "context": "Chat", "bindings": { "tab": "command:english" } },
    { "context": "Autocomplete", "bindings": { "tab": "autocomplete:accept" } }
  ]
}
```

The second binding keeps Tab for the menus of slash commands and @-mentions: without it, the first one takes Tab there too. Tab is not a letter, so it works whatever keyboard layout is on. In an empty prompt, → still takes Claude Code's own suggestion. Another key works too, if Claude Code does not reserve it and it is not a character you type.

## Settings

Run `/config` and type `cc-grammar`:

| Setting | Default | What it does |
| :- | :- | :- |
| When | as I type and after I send | `as I type`: the gray English after a pause. `after I send`: the ✎ line. `off`: nothing goes to Haiku unless you press the key. |
| Rule names | English | The language of the one-word rule name after each correction on the ✎ line, or `none`. |
| Pause (ms) | 700 | How long after your last key the draft goes to Haiku. |
| Longest draft (characters) | 280 | The longest draft that gets gray English while you type, and the longest message in another language that gets a ✎ line. The key takes longer drafts too. |

## What goes where

- Your own words go to Claude Haiku for their English: a draft after each pause, even one you never send, and a message you sent without seeing its English.
- Quote lines (`> …`) are not sent. A long paste, which the prompt shows as `[Pasted text #1 +40 lines]`, is not sent either: only that placeholder goes with your words. A short paste, which the prompt keeps inline, counts as your own words.
- In shell mode (`!`) cc-grammar stays out of the way: no gray English, and the key does nothing.
- Claude, in your conversation, never sees any of it: the gray text and the ✎ line are drawn for you only.
- Nothing is written to disk.
- Each check is one short Haiku call. Its cost does not show in your status line's total.

## Version 1

v1 checked a prompt after you sent it, with an async `UserPromptSubmit` hook, and wrote up to three corrections to a file for your status line. It is kept at the [v1.0.0 tag](https://github.com/rapita/cc-grammar/tree/v1.0.0). Claude Code 2.1.300 reserves plugin names that start with `claude-`, so v1's name no longer passes validation, and v2 is named cc-grammar.

## Moving from an earlier install

Before 2.0.2 the repository was `rapita/claude-grammar` and the marketplace was named `rapita-claude-grammar`. That covers v1 (`claude-grammar`) and cc-grammar 2.0.0 and 2.0.1. In 2.0.2 the marketplace was named `rapita`.

1. `claude plugin marketplace remove rapita-claude-grammar` (or `rapita`, for 2.0.2). This also uninstalls what came from it, with its settings.
2. Install as above, and set your settings again in `/config`.
3. From v1 only: undo what `/claude-grammar:setup` added to your status line. With ccstatusline, delete the segment that runs `~/.claude/grammar-status.sh`. With a script of your own, delete the two lines it appended, the marker comment and the call. If setup wrote the whole `statusLine` block in `~/.claude/settings.json` because you had none, delete that block: deleting only its `command` line leaves invalid JSON. Then `rm ~/.claude/grammar-status.sh`.

## License

MIT. [CONTRIBUTING.md](./CONTRIBUTING.md) covers how it works, the tests, and running it from source.
