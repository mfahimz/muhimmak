# Agent activity log — index

Tool-agnostic session log for the Muhimmak repo. ANY agent working on
this codebase — Claude Code, Gemini, Codex, or anything else — reads
and writes here. This is the "brain" that survives across tools.

## How this loads automatically

`CLAUDE.md` imports `agent-log/LATEST.md`. That file is a PLAIN COPY
of the current newest session file's content (not a symlink — symlinks
don't survive every zip/transfer tool reliably, a plain copy is more
portable). Whenever a session file changes or a new one is created,
`LATEST.md` must be updated to match — see the exact step below.

## Rule for every agent, every session

**At session start:** you'll already have the latest session file's
content loaded automatically (via `LATEST.md`). Read it. That's the
current state of the project. Only go read older numbered files or
`legacy/` if you're specifically hunting for older history not
mentioned in the latest file.

**At session end (or when the user asks to close out / wrap up):**
1. If the current latest file is still small (under ~150 lines),
   append a new dated entry to it directly, then copy its full updated
   content over `LATEST.md`:
   ```
   cp agent-log/0001_2026-08-28_claude-code-migration.md agent-log/LATEST.md
   ```
   (use whatever the actual current latest filename is)
2. If it's getting long, create a NEW file: next number in sequence,
   `NNNN_YYYY-MM-DD_short-slug.md` (zero-padded 4-digit sequence,
   e.g. `0002_2026-08-29_ticket-testing.md`), then copy IT over
   `LATEST.md`:
   ```
   cp agent-log/0002_2026-08-29_ticket-testing.md agent-log/LATEST.md
   ```
3. Either way, update the table below with the new/changed entry

**Never edit a past session's file after that session closed.**
Append-only. If something from an old entry turns out to be wrong,
note the correction in the NEW file — don't rewrite history.

**Do not forget step 1/2's copy-to-LATEST.md action** — if you skip
it, the next session (possibly a different tool/agent entirely) will
load stale content. This is the single most important mechanical step
in this whole system.

## Session files (newest first)

| # | File | Date | Summary |
|---|------|------|---------|
| 0001 | `0001_2026-08-28_claude-code-migration.md` | 2026-08-28 | Migrated dev workflow from claude.ai chat + Antigravity IDE to Claude Code directly. Set up CLAUDE.md, .claude/rules/, this agent-log system. |

## Legacy reference (not auto-loaded, historical only)

`legacy/PROJECT_STATE_0708.md` and `legacy/PROJECT_STATE_v0821.md` —
the old single-file project state docs from before this log system
existed. Read only if you need historical context older than session
0001. Everything relevant from v0821 was carried forward into 0001.
