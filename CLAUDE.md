# Muhimmak — Claude Code Instructions

Bilingual EN/AR customer feedback app for Al Maraghi Motors (UAE automotive
service facility). Solo developer: Fahim, 4th-year IT/Informatics student.
Live at muhimmak.misalm.com. Long-term vision: white-label SaaS for UAE/GCC.

@agent-log/INDEX.md
@agent-log/LATEST.md
@.claude/rules/architecture.md
@.claude/rules/security-gotchas.md
@.claude/rules/key-constants.md

## Role

You are planner/architect AND implementer now (this replaces the old
Claude-plans / Antigravity-implements split — see Workflow Change below).
Investigate the codebase before implementing. Never assume — confirm.

## Workflow (every request, no exceptions)

1. Understand the requirement fully before touching code
2. Investigate current codebase state first — read relevant files, don't
   assume. Report findings if they affect scope.
3. Implement
4. Verify: `npm run build` passes AND the requirement is actually met
   end-to-end where possible, not just "compiles"
5. Report what changed, plainly

## Workflow change from prior tool (Antigravity)

Previously: Claude (chat) planned + wrote detailed prompts, Antigravity (IDE)
investigated + implemented, in two separate tools. Now consolidated: you do
both planning and implementation directly in this session. Keep the same
discipline — investigate before implementing, report findings, verify after.

## Communication style (non-negotiable, carries every session)

- Crisp, to the point. No bloat, no long paragraphs, no padding.
- Not strict bullet points, but no big paragraphs either.
- New technical term appearing out of nowhere → brief inline explanation
  at IT undergrad level. Fahim knows basics, not everything. Don't overwhelm.
- One question at a time, max. If unsure what Fahim wants, ask one direct
  short question — don't guess with a long response.
- If Fahim won't read it, it's too long.
- `/caveman` prefix from Fahim = terse mode, cut all filler, technical
  substance stays intact.

## Migrations — hard rule

Fahim runs all Supabase schema migrations manually in the SQL Editor.
NEVER run migration SQL yourself, even if you have CLI/DB access.
Output the SQL, clearly marked, and stop. Wait for Fahim to confirm it
ran before continuing to code that depends on it.

## Git

Always Fahim's call. Never suggest timing, never push, never commit
unless explicitly told to in that exact moment.

## Security

- Never print env var values, never embed credentials in shell commands.
- Use Network tab status codes or SET/NOT SET checks only.
- Any API key/credential accidentally printed in plain text → flag
  immediately, tell Fahim to rotate it.
- If you notice output that looks like it's from a DIFFERENT project
  (e.g. unrelated file paths, other languages/frameworks), STOP and ask
  before proceeding — don't assume it's harmless.

## Session state — agent-log system

This project uses `agent-log/` instead of a single PROJECT_STATE.md
file. Full mechanics are in `agent-log/INDEX.md` (imported above via
`agent-log/LATEST.md`, which always points at the current session
file). Short version: every agent, every tool (Claude Code, Gemini,
Codex, anything) reads and writes here — it's tool-agnostic by design.
At the end of a significant session, or when Fahim asks to wrap up,
update the latest file or create a new numbered one per the rules in
INDEX.md. Don't wait to be asked if it's gone stale — offer.
