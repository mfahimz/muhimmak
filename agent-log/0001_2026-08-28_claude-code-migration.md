# Session 0001 — 2026-08-28 — Claude Code migration

Agent: Claude (claude.ai chat, migrating workflow to Claude Code this
session). This file replaces PROJECT_STATE.md as the carried-forward
context mechanism. See legacy/PROJECT_STATE_v0821.md for anything not
repeated here.

---

## Project

Muhimmak (مهمك) — bilingual EN/AR customer feedback app for Al Maraghi
Motors (UAE automotive service facility). Solo dev: Fahim, 4th-year
IT/Informatics student. Live at muhimmak.misalm.com. Long-term vision:
white-label SaaS for UAE/GCC market.

Stack, architecture rules, security gotchas, key constants: see
`CLAUDE.md` and `.claude/rules/*.md` at repo root — those are always
loaded, don't repeat here.

## What changed this session (the migration itself)

- Dev workflow moved from claude.ai chat (Claude plans, Antigravity IDE
  implements) to Claude Code doing both directly
- Created `CLAUDE.md`, `.claude/rules/architecture.md`,
  `.claude/rules/security-gotchas.md`, `.claude/rules/key-constants.md`
  — all auto-load every session
- Patched pre-existing `AGENTS.md` (Antigravity's old ruleset, already
  in repo since Aug 3) — fixed two conflicts: (1) it implied
  auto-translate script output is fine to trust for customer-facing
  copy without human review — now notes customer-facing text needs
  Arabic reviewer sign-off, internal admin UI strings can rely on the
  script alone; (2) it implied granting full CRUD to `authenticated`
  by default on every new table — now says grant only what active RLS
  policies + UI actually use, least-privilege by default
- This agent-log system replaces PROJECT_STATE.md going forward —
  every session gets its own append-only file, INDEX.md always loads
  and points to the latest one

## Features built in the last two sessions before this migration (Aug 20 → Aug 28)

### 1. Support ticket lifecycle emails — DONE, migration applied, NOT manually tested end-to-end

- Migration `0014_ticket_lifecycle.sql` applied by Fahim in Supabase ✓
- Schema: `support_tickets.status` now includes `'closed'` (was
  open/in_progress/resolved only). New columns: `assigned_to`,
  `assigned_at`, `resolved_at`, `closed_at`. New table:
  `support_ticket_comments`
- Backend (`support.service.ts`): `sendTicketLifecycleEmail()` helper,
  `assignTicket()`, `addTicketComment()`, `getTicketComments()`,
  `updateTicketStatus()` extended to email on every status change
- UI (`SupportListClient.tsx`): assign dropdown, comment box, status
  selector now includes closed — ALL scoped super_admin/ceo ONLY.
  Note: an early draft of this had agm/manager also able to view
  tickets/comments — that was WRONG and got corrected mid-build.
  If you see any reference to agm/manager having ticket access, it's
  stale, ignore it.
- New API routes: `PATCH /api/v1/support/[id]/assign`,
  `GET`+`POST /api/v1/support/[id]/comments`
- `npm run build` PASS, i18n scanner PASS at time of build
- **NOT YET TESTED**: no real lifecycle event has actually been
  triggered and confirmed to send a real email. Build passing is not
  the same as verified working — this exact gap bit the AI Reports
  Insights feature before (see below), don't repeat it here without
  eventually testing

### 2. Announcements system — DONE, migration applied, is_active=false (not live), NOT manually tested end-to-end

- New feature: customer-facing announcement shown on the feedback
  thank-you screen (`SurveyClient.tsx`, `step === "completed"`),
  triggered when session's final `computeWeightedScore()` exceeds a
  threshold, shown once per plate number (deduped via existing
  deterministic `plate_number_hash` HMAC pattern — same hash used for
  6-hour duplicate submission check and drop-off/pick-up session
  linking elsewhere in the codebase)
- Migration `0015_announcements.sql` applied. Tables:
  - `announcements` — title/body in EN+AR, `min_score_threshold`
    (default 60), `is_active` boolean with a PARTIAL UNIQUE INDEX
    enforcing only one row can be active at a time, `image_url` field
    for future generic template use (nullable, unused by the current
    hardcoded Autoversa component)
  - `announcement_views` — one-time-per-plate ledger, unique
    constraint on `(announcement_id, plate_number_hash)`, service_role
    access only, no authenticated/anon grants at all (intentional —
    this table is purely an internal dedup ledger)
- Backend: new `src/server/services/announcements.service.ts` —
  `getActiveAnnouncementForSession()`. Wired into
  `sessions.service.ts` completion flow, evaluated in the same block
  as the existing `showQr` Google Review logic, but with a DIFFERENT,
  SEPARATE suppression rule:
  - Google Review QR suppresses on `drop_off` stage (customer hasn't
    seen the car yet) — this is UNCHANGED, specific to reviews only
  - Announcements do NOT suppress on `drop_off` — they show on BOTH
    stages, gated only by `isPendingScoring`. This was a real bug:
    first implementation wrongly inherited the QR's drop_off
    suppression. Caught and fixed this session. If you ever see logic
    that blocks announcements on drop_off, that's the bug, fix it.
- Frontend: `AutoversaAnnouncement.tsx` — custom hardcoded visual
  component, specific to `slug === 'autoversa-launch'`, not the
  generic template. `AnnouncementCard.tsx` — generic reusable template
  for any FUTURE announcement slug (simple text + optional image,
  not yet exercised by anything real)
- First real announcement seeded via migration: Autoversa BMW service
  division launch. Bilingual copy written this session:
  - EN title: "Introducing Autoversa"
  - EN body: "We have opened a new BMW service division. Ask any of
    our representatives to learn more."
  - AR title: "نقدم لكم أوتوفيرسا"
  - AR body: "افتتحنا قسماً جديداً لخدمة سيارات بي إم دبليو. يسعد أحد
    ممثلينا بمساعدتكم لمعرفة المزيد."
  - `is_active = false` — Fahim must NOT flip this to true until (a)
    Arabic reviewer signs off on the copy above, (b) end-to-end test
    confirms the component renders + view logs correctly + doesn't
    repeat for the same plate
- Admin CRUD UI for announcements (`/dashboard/announcements`,
  super_admin/ceo only, full create/edit/delete/toggle-active with
  image upload to a new Storage bucket): SCOPED IN DETAIL, NOT BUILT
  YET. The build prompt exists in prior chat history if needed, but
  wasn't executed before this migration. Re-scope from scratch if the
  old prompt isn't handy — it's not complex, just wasn't done.
- `npm run build` PASS, i18n scanner PASS at time of build

### 3. Incident note (informational, no ongoing action needed)

Mid-session on Aug 26, an Antigravity tool output began with a
reference to editing `AiSettingsController.php` — a file that does not
exist anywhere in this repo (this is a TypeScript/Next.js project, no
PHP). Investigated: root cause was Fahim having a second, unrelated
project (`crm_auh_backend`, a PHP codebase) open in the same IDE
window. It was IDE tab-bleed metadata attached to the agent's context,
NOT an actual write to the wrong repo. `git status` confirmed zero
unexpected files touched in `muhimmak`. No damage occurred. Worth
remembering as a pattern: if any agent output ever references a file
path, language, or framework that doesn't belong to this project, stop
and verify via `git status` before trusting anything else in that
output — don't assume it's automatically fine just because it turned
out fine this time.

## Currently open / not yet done (carry forward)

**Needs manual end-to-end testing (highest priority, do before adding
more features on top of these):**
1. AI Reports Insights (built ~Aug 20, see legacy file for detail) —
   cache-or-regenerate flow never fired in a real browser session
2. Support ticket lifecycle emails (see above) — no real trigger
   tested yet
3. Announcements system (see above) — Arabic copy not reviewed, no
   real session tested, must stay `is_active=false` until both are done

**Scoped but not built:**
- Announcements admin CRUD UI + image upload Storage bucket

**Written but not run:**
- Domain backfill script for AI Reports Insights
  (`npx tsx scripts/backfill-question-domains.ts`) — for the 18
  existing live questions

**Waiting on external input:**
- New 14-question Visit Journey form redesign — bilingual PDF sent to
  Arabic reviewer, no response yet, not built into the app

**Critical, unresolved for weeks, carried forward every session:**
- Vercel Hobby plan cron limit — 4 crons defined
  (`daily-summary`, `weekly-summary`, `visit-closures-digest`,
  `rotate-qr-code`), Hobby plan only allows 2, Vercel silently drops
  the other 2. Must consolidate to ≤2 endpoints or upgrade to Vercel
  Pro ($20/mo, 40-cron limit). Nothing that depends on the dropped
  crons is currently reliable.
- `package.json` version still reads `0.1.0`. Git tag `v0.2.0` exists
  on GitHub but the file itself was never bumped.

**Longer-standing open items (lower priority, still valid):**
- Full receptionist role QA pass (25-item checklist, 0 tested)
- Full Visit Journey QA (9-item checklist, 0 tested)
- `al-maraghi-icon-white.png` is a blank placeholder, needs the real
  asset from Fahim
- UAE trademark search (MOET eServices, Nice Classes 9/42) —
  "Muhimmak"/"مهمك" — still pending, blocks confident public branding
- `roleTag` not yet in `BuilderField` TypeScript interface or Form
  Builder UI
- Receptionist KPI question-level tagging — parked, see
  key-constants.md for why current scoring is intentionally
  inconsistent until this exists
- Phase 2 kiosk/native app — parked, do NOT raise unless Fahim brings
  it up first
- `plate_categories` admin UI — SQL-only for now
- Notification recipient picker end-to-end verification — pending
  since Aug 3, never circled back
- Google review click + QR-shown tracking verification on a real
  submission — pending since Aug 3
- `interaction_metadata` payload verification on a real submission —
  pending since Aug 3
- Supabase paid tier decision — not made yet

## Git state at end of this session

Uncommitted, matches what's described above: modified support/reports/
sessions/forms services + UI files, plus untracked new files
(announcements feature, migrations 0014/0015, this agent-log folder,
CLAUDE.md, .claude/rules/). Nothing committed or pushed — that's
Fahim's call per standing rule, not done automatically.
