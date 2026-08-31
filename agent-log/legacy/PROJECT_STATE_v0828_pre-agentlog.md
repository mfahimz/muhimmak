# Muhimmak — Project State
*Version: v0828 | Last updated: August 28, 2026*
*Supersedes: PROJECT_STATE_v0821.md*
*Migrated from claude.ai chat workflow to Claude Code this session —
see CLAUDE.md "Workflow change" section for what changed.*

---

## SESSIONS SINCE v0821 (Aug 20 → Aug 28) — NOT YET FOLDED INTO BODY BELOW

**1. Support ticket lifecycle emails — DONE, migration applied, NOT
manually tested yet**
- Migration `0014_ticket_lifecycle.sql` applied by Fahim in Supabase ✓
- Schema additions: `support_tickets.status` now includes `'closed'`,
  new columns `assigned_to`, `assigned_at`, `resolved_at`, `closed_at`,
  new table `support_ticket_comments`
- Backend: `support.service.ts` extended —
  `sendTicketLifecycleEmail()`, `assignTicket()`, `addTicketComment()`,
  `getTicketComments()`, `updateTicketStatus()` extended for all statuses
- UI: `SupportListClient.tsx` — assign dropdown, comment box, status
  selector includes closed, all scoped super_admin/ceo ONLY (agm/manager
  explicitly excluded — this was corrected mid-build, watch for this if
  reviewing old Antigravity output that mentions agm/manager access)
- New API routes: `PATCH /api/v1/support/[id]/assign`,
  `GET`+`POST /api/v1/support/[id]/comments`
- `npm run build` PASS, i18n scanner PASS
- **STILL NEEDS**: Fahim to manually trigger each lifecycle event once
  (create, assign, status change x4, comment) and confirm real emails
  land correctly — never verified end to end, only build-verified

**2. Announcements system — DONE, migration applied, is_active = false
(not live), NOT manually tested yet**
- New feature: customer-facing announcement shown on feedback
  thank-you screen (`SurveyClient.tsx`, `step === "completed"`),
  triggered by session score > threshold, shown once per plate number
  (via `plate_number_hash`, deterministic HMAC, reused pattern from
  existing duplicate-detection logic)
- Migration `0015_announcements.sql` applied — tables `announcements`
  (title/body EN+AR, `min_score_threshold` default 60, `is_active`
  with partial unique index enforcing only one active at a time,
  `image_url` for future use) and `announcement_views` (one-time-per-
  plate ledger, unique constraint on `announcement_id` +
  `plate_number_hash`)
- Backend: new `src/server/services/announcements.service.ts` —
  `getActiveAnnouncementForSession()`, wired into `sessions.service.ts`
  completion flow, evaluated same place as `showQr` but with SEPARATE
  suppression logic — only `isPendingScoring` suppresses announcements,
  NOT `drop_off` stage (this was a real bug caught and fixed —
  announcements ARE meant to show on both drop_off and pick_up, unlike
  the Google Review QR which suppresses on drop_off; do not conflate
  these two suppression rules again)
- Frontend: `AutoversaAnnouncement.tsx` (custom hardcoded visual for
  this specific launch, slug `autoversa-launch`) +
  `AnnouncementCard.tsx` (generic reusable template for future slugs)
- First real announcement seeded: Autoversa BMW division launch,
  bilingual copy written, `is_active = false` — Fahim must get Arabic
  copy reviewed by his usual Arabic reviewer BEFORE flipping active
- Admin CRUD UI for announcements: SCOPED, NOT YET BUILT (prompt was
  in progress when this session ended — includes Storage bucket for
  optional image upload, `/dashboard/announcements` route,
  super_admin/ceo only, full CRUD with active-toggle confirmation
  dialog since only one can be active at a time)
- `npm run build` PASS, i18n scanner PASS
- **STILL NEEDS**: Admin CRUD UI (scoped, not built), Arabic reviewer
  sign-off on Autoversa copy, end-to-end test (complete a session
  >60%, confirm component renders + view logged + no repeat for same
  plate), then flip `is_active` to true

**3. Incident note**: mid-session, an Antigravity tool output began
with an unrelated PHP file edit reference (`AiSettingsController.php`)
from a completely different project (`crm_auh_backend`). Root cause
confirmed: Fahim had both projects open in the same IDE window, and it
was IDE tab-bleed metadata, not an actual cross-project code edit —
`git status` confirmed zero unexpected files touched. No actual damage,
but flagged as a real risk pattern — keep unrelated projects in
separate IDE windows going forward.

---

---

## TASK
Building and maintaining **Muhimmak** (مهمك) — bilingual EN/AR customer feedback app for **Al Maraghi Motors** (UAE automotive service facility). Fahim is sole developer/owner, 4th year IT student. Claude = planner/architect only, never touches code. Google Antigravity IDE (Gemini-based) = execution agent.

App is **LIVE** on Vercel + GitHub (`github.com/mfahimz/muhimmak`, main branch).

---

## COMMUNICATION PREFERENCES (carry forward to every new chat)

- Crisp responses, no bloat, no long paragraphs
- Technical terms: brief inline explanation at IT undergrad level only when new
- One question at a time max
- Antigravity prompts: fully detailed, always in a plaintext code block, logic/requirements not full code
- `/caveman` prefix = terse mode, cut all filler
- Git push always Fahim's call — never suggest it
- Security: never print env values or embed credentials in shell commands
- 25-message chat limit — count starts after handoff; warn only at clean end point; Fahim pastes handoff; Claude updates memory + creates PROJECT_STATE.md (must include this section)
- Fahim archives a PROJECT_STATE.md per closed session (versioned
  filenames) — always version the filename and note what it supersedes
- **NEW as of this migration:** development moved from claude.ai chat +
  Antigravity IDE to Claude Code directly. `CLAUDE.md` +
  `.claude/rules/` now carry all of the above automatically every
  session — this file (`PROJECT_STATE.md`) is imported by `CLAUDE.md`
  and loads automatically too. The 25-message limit concept doesn't
  map directly to Claude Code; use natural session boundaries instead
  and ask to update this file when wrapping up

---

## WORKFLOW RULES (permanent, no exceptions)

1. Understand requirement
2. Antigravity investigates codebase first, reports findings
3. Claude writes implementation prompt in a plaintext code block
4. Antigravity implements
5. Verify: `npm run build` passes + requirement actually met (not just compiles, actual end-to-end test where possible)

- Claude is planner/architect ONLY — never touches code
- Migrations run manually by Fahim in Supabase SQL Editor (Antigravity has CLI access but Fahim still prefers doing schema changes himself)
- Every migration: mandatory footer (enable RLS + GRANT authenticated + GRANT service_role)
- RLS policies must call `has_permission(resource, action)` — never hardcode role checks (exception: support_tickets uses role-based check, documented)
- Single quotes in SQL/JSONB must be doubled (`''`)
- i18n: grep new namespace directly in en.json AND ar.json after every feature — scanner only checks parity not presence
- No dashes in UI copy — app-wide
- No raw IDs/UUIDs shown in UI ever
- **Antigravity's sandboxed environment has NO authenticated browser access** — it can query DB directly and run builds, but cannot click through the live app UI. End-to-end UI verification must be done by Fahim manually (screenshots) or by Claude via Claude-in-Chrome browser tools when available.

---

## 🔴 CRITICAL UNRESOLVED (carried forward, unchanged for weeks)

1. **Vercel cron limit** — Hobby plan max 2 crons, 4 defined (`daily-summary`, `weekly-summary`, `visit-closures-digest`, `rotate-qr-code`). Vercel silently dropping 2. Must consolidate to ≤2 or upgrade to Pro ($20/mo, 40-cron limit).
2. **package.json version** still `0.1.0` — git tag `v0.2.0` exists on GitHub but file never updated.

---

## STACK

- Next.js 16.2.12 (App Router, TypeScript, Tailwind, `src/`)
- Supabase (PostgreSQL + RLS, Frankfurt eu-central-1)
- DeepSeek V4 Flash (`deepseek-v4-flash`, always `thinking:{type:'disabled'}`)
- Resend (`muhimmak.misalm.com` verified, eu-west-1)
- Vercel (Hobby plan, Frankfurt — co-located with Supabase)
- GitHub `github.com/mfahimz/muhimmak`
- Supabase project: `nhtzqdyrvjvunvyjaqob.supabase.co`

---

## THIS SESSION COMPLETED (Aug 20, 2026)

**1. Verified Aug 7 data-integrity bug fixes (5 bugs)** — all confirmed via follow-up checks with real numbers:
- Threshold display text (drop-off "below threshold" bug) — fixed
- Low satisfaction alert firing at wrong threshold (80 vs 50 fallback mismatch) — fixed, standardized via `DEFAULT_LOW_SATISFACTION_THRESHOLD` constant
- AI Analysis regenerating on every page load — fixed (generates once at completion, persisted), idempotency guard added and confirmed (prevents double-generation on repeat completion calls)
- Session counts not reconciling (Sessions page vs Reports page) — fixed, verified 21=21 across all date ranges, completion rate math checks out
- Dashboard "no active receptionists" despite Team page showing one — fixed via left-join from profiles instead of session-join

**2. Multi-condition (AND) branching logic** — implemented and fully verified:
- `FieldCondition[]` type, `normalizeDependsOn()` shared helper (`src/lib/forms/condition.ts`)
- Backward compatible with all 20 live legacy single-condition questions
- Form Builder UI: multi-row condition editor, static AND badges, per-row delete, "+ Add condition"
- `getConditionSources()` confirmed correctly scoped per-field (shared across all condition rows on that field, not per-row) — investigated, no bug found
- Duplicate source question across rows deliberately allowed (needed for range conditions like Q1≥2 AND Q1≤4)

**3. Bilingual PDF verification workflow — existing live form (18Q)**
- Extracted live "Visit Journey Feedback" form (8 drop-off + 10 pick-up) via Claude-in-Chrome DOM scraping of Form Builder UI
- Built EN/AR side-by-side PDF (wkhtmltopdf + Noto Naskh Arabic font)
- Reviewer returned handwritten corrections (photo) — Claude cross-checked each against English meaning before approving
- Approved: Drop-off Q5 (فائدة→مساعدة), Drop-off Q6 option tweak, Pick-up Q2 rewrite, Pick-up Q6 rewrite
- Drop-off Q1: clarified correction was meant for Option 1 only (not the question) — kept as full-sentence per Fahim's explicit call, even though inconsistent in length with other options
- **Confirmed safe update method:** Form Builder UI save triggers proper versioning (clones row, closes old as `status='closed'`, new UUID + `parent_id`, old responses stay linked to old version). Raw SQL UPDATE on `fields` JSONB would NOT break the FK but WOULD silently corrupt historical response accuracy (old responses would appear answered against corrected text).
- **Fahim applied all 5 corrections manually via Form Builder UI and saved — DONE, versioning triggered correctly.**

**4. New 14-question Visit Journey redesign (draft, not yet built)**
- Iteratively designed down from 18 to 14 questions (5 drop-off + 9 pick-up)
- Key correction mid-design: pick-up feedback happens BEFORE invoicing — customer hasn't seen the car yet, so "car condition" questions were removed as genuinely un-answerable at that stage
- Final pick-up themes: communication (with actionable preferred-channel follow-up), timing (proactive vs reactive delay disclosure), price (kept deliberately general, not surprise-billing-specific per Fahim's request), trust-in-outcome ("how confident are you the work was done right" — honest substitute for quality since car unseen), loyalty, catch-all
- Built EN/AR bilingual PDF (first-pass translation) — hit and fixed a wkhtmltopdf RTL bug where 2 long Arabic lines with mid-sentence commas clipped off-page; fixed by shortening the sentences (CSS fixes didn't work)
- PDF handed to Fahim for reviewer — **NOT yet reviewed, not yet built into the app**

**5. AI-Powered Reports Insights**
- New `report_insight_cache` table: date range + session_count/latest_session_at/latest_response_at watermark + summary_json + generated_at, unique per range
- RLS: proper `has_permission('detailed_reports','view')` SELECT policy (caught and fixed a first-draft violation that had RLS enabled with zero policies)
- New `domain` field on `BuilderField` — controlled taxonomy (booking/arrival/reception/communication/transparency/timeliness/repair_quality/pricing/loyalty/overall_experience/other), inferred ONCE by DeepSeek at form-save time, persisted, never re-inferred at report time
- Backfill script written for 18 existing questions (`npx tsx scripts/backfill-question-domains.ts`) — **NOT yet run**, Fahim must run manually
- Cache-or-regenerate logic in `reports.service.ts`: compares session_count + latest timestamps, only calls DeepSeek if data changed since last cache
- `ReportsClient.tsx`: overall summary + per-domain insight cards (summary/sentiment/mentionCount/themes), EN/AR i18n added
- **Migration applied by Fahim in Supabase SQL Editor this session** (confirmed via screenshot — "Success. No rows returned")

---

## 🟡 IMMEDIATE NEXT STEP (pick up here)

**Three features now sit in "built + build-verified but NOT manually
end-to-end tested" state — batch these into one testing pass:**

1. **AI Reports Insights** (from Aug 20 session) — generate → cache-hit
   → regenerate-on-new-data flow never fired once in a real browser.
   Open `/dashboard/reports`, pick a date range, screenshot loaded
   state, reload, screenshot again, switch to Arabic, screenshot once
   more. Then query `report_insight_cache` via SQL to confirm
   `generated_at`/`session_count` before/after values.

2. **Support ticket lifecycle emails** (this session) — trigger each
   event once for real (create ticket, assign it, change status through
   all four values, add a comment) and confirm actual emails land in
   both submitter's and super_admin's inbox with correct content per
   event type.

3. **Announcements system** (this session) — complete a real feedback
   session scoring above 60% on both drop_off and pick_up stages,
   confirm the Autoversa component renders on the thank-you screen,
   confirm a row lands in `announcement_views`, confirm it does NOT
   show again for the same plate on a second session. Do this BEFORE
   flipping `is_active` to true in production, and get Arabic copy
   reviewed first.

**Also queued right after testing:**
- Build the deferred announcements admin CRUD UI
  (`/dashboard/announcements`, full scope including image upload +
  Storage bucket, super_admin/ceo only) — was scoped but not started
  when this session ended
- Decide whether/when to run the domain backfill script for the 18
  existing questions (AI Reports Insights feature)
- Wait for Arabic reviewer's feedback on the new 14-question form
  draft, then repeat the verify → apply cycle (creating a NEW form,
  not editing the live one — exact creation method not yet decided)

---

## KNOWN OPEN ITEMS

- 🔴 Vercel cron limit (see critical section)
- 🔴 package.json version bump to 0.2.0
- 🟡 AI Reports Insights end-to-end verification (see above)
- 🟡 Domain backfill script not yet run (18 existing questions)
- 🟡 New 14-question form draft PDF awaiting Arabic reviewer feedback
- Full receptionist role QA pass (25-item checklist, 0 tested)
- Full Visit Journey QA (9-item checklist, 0 tested)
- `al-maraghi-icon-white.png` real asset from Fahim (blank placeholder)
- UAE trademark search (MOET eServices, Nice Classes 9/42)
- `roleTag` not yet in `BuilderField` TypeScript interface or Form Builder UI
- Receptionist KPI question-level tagging — parked
- Phase 2 kiosk/native app — parked, don't resume unless Fahim raises it
- `plate_categories` admin UI — SQL-only for now
- Notification recipient picker end-to-end verification (pending since Aug 3, never circled back)
- Google review click + QR-shown tracking verification on real submission (pending since Aug 3)
- `interaction_metadata` payload verification on real submission (pending since Aug 3)
- Supabase paid tier decision

---

## KEY CONSTANTS

- Roles (descending): super_admin → ceo → agm → manager → receptionist. super_admin/ceo always full access, no exceptions.
- Scoring: star=`(rating/5)*100`, MC=option score, numeric_scale=`((val-1)/9)*100`, weighted, sums to 100 per form (per tab independently for Visit Journey forms). Skipped/branched-hidden questions excluded from denominator. Server-side only.
- Google review threshold: 90% default, server-side, client gets `showQr` boolean. Suppressed entirely for drop-off stage sessions.
- Facility singleton ID: `00000000-0000-0000-0000-000000000000`
- Domain: `muhimmak.misalm.com`
- No dashes in UI copy
- Eastern Arabic numerals in Arabic mode except PIN entry/display
- DeepSeek model: `deepseek-v4-flash` only, `thinking:{type:'disabled'}`, temp varies by feature (0.2 for reports/domain-inference, 0.7 for form generation/closing questions)
- No raw IDs/hashes in UI
- `/feedback` (PublicFeedbackClient.tsx) always light theme — never touch for dark mode
- All routes are thin wrappers calling service functions in `src/server/services/`
- Every service file has `'server-only'` as first line
- `createAdminClient()` for all writes bypassing RLS
- `DEFAULT_LOW_SATISFACTION_THRESHOLD = 50` — shared constant, use everywhere, never hardcode fallback values separately

---

## RECURRING GOTCHAS (check every time)

- Every migration footer mandatory: RLS + GRANT to `authenticated` AND `service_role` on every new table
- Every new RLS policy must call `has_permission(resource, action)` — never hardcode role checks (support_tickets is the documented exception)
- Anon SELECT/UPDATE policies: always scope tightly (e.g. `channel = 'public_qr'`), never broad
- i18n: grep new namespace in en.json directly, don't just trust the completeness scanner (it only checks EN/AR parity, not namespace presence)
- `npm run dev` restart (not browser refresh) required after en.json edits
- Antigravity's sandbox cannot access the live authenticated browser — UI end-to-end checks need Fahim or Claude's own browser tools

---

## AVERAGE DB CALLS PER ROUTE (for latency context)

| Route | DB Calls |
|---|---|
| `/dashboard` | 8–9 |
| `/dashboard/sessions` | 4 |
| `/dashboard/sessions/[id]` | 7–14 |
| `/feedback/[token]` | 3 |
| `/api/v1/sessions/update` | 7–9 |

Frankfurt + Frankfurt = ~1ms per call.
