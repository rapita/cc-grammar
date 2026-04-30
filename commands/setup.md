---
description: Analyze and set up the grammar coach statusline widget. Idempotent — safe to re-run after plugin updates or settings changes.
allowed-tools: Bash
---

Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh` and show the user its full output verbatim.

If the script printed any manual steps (typically adding a snippet to a settings file or running ccstatusline's TUI), restate them in one short bullet list at the end so the user has a clear next-action checklist. Do not invent additional steps.
