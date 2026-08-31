# Security gotchas (check every time — these have caused real bugs)

## service_role still needs explicit GRANTs

`service_role` bypasses RLS but still requires explicit table-level
GRANTs. Has blocked production features on `profiles`, `forms`,
`templates`, `form_types`, `sessions`, `responses`, `facility_settings`,
`visit_closures` before. Expect it on every new table — always include
in migration footer.

## Anon-facing RLS policies — verify scope every time

Real vulnerabilities caught pre-production:
- Anon SELECT on `public_submission_log` would have exposed all plate
  numbers publicly if not scoped
- `sessions_update_anon_kiosk` with no channel filter would have let
  anon update staff sessions
Always check anon-facing policies for over-broad exposure before
considering a migration done. Scope tightly (e.g. `channel = 'public_qr'`).

## RLS enabled with zero policies = default deny

This is a valid and sometimes intentional pattern (e.g.
`announcement_views` — service_role only, no authenticated/anon access
needed at all). Don't assume "no policy" is a bug — but always state
explicitly in the migration comments when this is intentional, so a
future reader doesn't "fix" it by adding an unnecessary policy.

## Credential handling

Never print env var values. Never embed credentials in shell commands.
If a key/secret ever gets printed in plain text by accident (yours or a
tool's output), flag it immediately and tell Fahim to rotate it. Both
Supabase service role key and DeepSeek API key have been rotated
multiple times before due to this — treat it as a real, recurring risk,
not hypothetical.

## Cross-project contamination check

If tool output or logs reference a file path, language, or framework
that doesn't belong to this project (e.g. PHP files, unrelated repo
names), STOP. Do not proceed. Report exactly what was seen and ask
before continuing — this has happened before due to multiple projects
open in the same IDE window. Run `git status` in the actual muhimmak
repo to confirm nothing unexpected changed before trusting any other
output from that session.
