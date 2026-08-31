# Muhimmak — Project State
*Version: v0821 | Last updated: August 20, 2026*
*Supersedes: PROJECT_STATE_0708.md*

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
- **NEW as of this session:** Fahim is now archiving a PROJECT_STATE.md per closed chat (versioned filenames) — always version the filename and note what it supersedes

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

**AI Reports Insights end-to-end verification is NOT done.** Antigravity's sandbox has no authenticated browser access — could not click through the live Reports page. Anonymous RLS denial confirmed policy works, `npm run build` passes, but the actual generate → cache-hit → regenerate-on-new-data flow has never fired once.

**Fahim needs to:**
1. Open `/dashboard/reports` in his own browser, pick a date range, screenshot the loaded state
2. Reload the same page, screenshot again
3. Switch to Arabic, screenshot once more
4. Send screenshots back — Claude will have Antigravity query `report_insight_cache` directly via SQL to confirm `generated_at`/`session_count` before/after values and close out verification

**After that:**
- Decide whether/when to run the domain backfill script for the 18 existing questions
- Wait for Arabic reviewer's feedback on the new 14-question form draft, then repeat the verify → apply cycle (this time creating a NEW form, not editing the live one — exact creation method not yet decided)

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
