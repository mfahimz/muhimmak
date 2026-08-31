# Muhimmak — Project State
*Last updated: August 5, 2026*

---

## TASK
Building and maintaining **Muhimmak** (مهمك) — bilingual EN/AR customer feedback app for **Al Maraghi Motors** (UAE automotive service facility). Fahim is sole developer/owner, 4th year IT student. Claude = planner/architect only. Google Antigravity IDE (Gemini-based) = execution agent.

App is **LIVE** on Vercel + GitHub (`github.com/mfahimz/muhimmak`, main branch). Phase 1 = QR self-serve feedback only.

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

---

## WORKFLOW RULES (permanent, no exceptions)

1. Understand requirement
2. Antigravity investigates codebase first, reports findings
3. Claude writes implementation prompt in a plaintext code block
4. Antigravity implements
5. Verify: `npm run build` passes + requirement actually met

- Claude is planner/architect ONLY — never touches code
- Migrations run manually by Fahim in Supabase SQL Editor
- `.agents/rules/ponytail.md` auto-applies YAGNI to every Antigravity prompt
- No raw IDs/UUIDs in UI ever
- Every migration: mandatory footer (enable RLS + GRANT authenticated + GRANT service_role)
- RLS policies must call `has_permission(resource, action)` — never hardcode role checks (exception: support_tickets uses role-based check, documented)
- Single quotes in SQL/JSONB must be doubled (`''`)
- i18n: grep new namespace directly in en.json AND ar.json after every feature — scanner only checks parity not presence
- No dashes in UI copy — app-wide

---

## 🔴 CRITICAL UNRESOLVED

1. **Vercel cron limit** — Hobby plan max 2 crons, 4 defined (`daily-summary`, `weekly-summary`, `visit-closures-digest`, `rotate-qr-code`). Vercel silently dropping 2. Must consolidate to ≤2 or upgrade to Pro ($20/mo, 40-cron limit).
2. **package.json version** still `0.1.0` — git tag `v0.2.0` exists on GitHub but file never updated.

---

## STACK

- Next.js 16.2.12 (App Router, TypeScript, Tailwind, `src/`)
- Supabase (PostgreSQL + RLS, Frankfurt eu-central-1)
- DeepSeek V4 Flash (`deepseek-v4-flash`, always `thinking:{type:'disabled'}`)
- Resend (`muhimmak.misalm.com` verified, eu-west-1)
- Vercel (Hobby plan, **Frankfurt** — co-located with Supabase)
- GitHub `github.com/mfahimz/muhimmak`
- Supabase project: `nhtzqdyrvjvunvyjaqob.supabase.co`

---

## THIS SESSION COMPLETED (Aug 5, 2026)

All items `npm run build` verified, i18n parity verified.

1. **Visit Journey two-stage session detail** — drop-off and pick-up shown as two labeled sections with separate fields, answers, and skipped analysis
2. **Google Review suppressed for drop-off** — `showQr` forced false server-side when `visit_stage='drop_off'`, both customer-facing and dashboard
3. **Stat card filtering instant** — moved from `router.push()` (server round-trip) to client-side `useMemo` filter; date range + pagination still server-side
4. **Dark/Light/System theme** — `next-themes` ThemeProvider in `layout.tsx`, `ThemeToggle` in `site-header`, login page refactored to CSS variables, `/feedback` excluded
5. **Low satisfaction in-app notification fixed** — was firing for every completed session; now guards with `threshold_percent` check same as email
6. **notification_email in edit user modal fixed** — column was missing from `profiles` select query in `users/page.tsx`
7. **Session delete (super_admin/ceo only)** — trash icon in list + Delete Session button in detail, AlertDialog confirmation, instant row removal from local state, audit logged
8. **Today's Pulse card on receptionist dashboard** — facility-wide completion rate + dynamic motivational message (5 tiers: null/0-40/41-70/71-90/91-100%)
9. **Support Ticket system** — `/dashboard/support/new` (all roles), `/dashboard/support` (super_admin/ceo), DeepSeek structures raw input into JSON, in-app + email to super_admin, migration `0012_support_tickets.sql` run in Supabase
10. **Sidebar active highlight bug fixed** — both Help items were highlighting simultaneously; now uses exact match for `/dashboard/support` and `/dashboard/support/new`
11. **Consent screen redesigned** — "Share Your Experience" headline, privacy label removed, body simplified, accept button dominant (full-width, top), "Skip" plain text link below
12. **Daily/weekly summary emails fixed** — were averaging `ai_text_score` (text-only AI score); now use full `computeWeightedScore()` same as reports and session detail
13. **Dashboard Total Feedback Score + Average Score fixed** — were hardcoded `"—"`; now computed from today's completed sessions via `computeWeightedScore()`
14. **Vercel moved to Frankfurt** — co-located with Supabase Frankfurt (~0.25s total latency vs ~1.07s Mumbai+Frankfurt, ~5x faster)

---

## KNOWN OPEN ITEMS

- 🔴 Vercel cron limit (see critical section)
- 🔴 package.json version bump to 0.2.0
- Full receptionist role QA pass (25-item checklist, 0 tested)
- Full Visit Journey QA (9-item checklist, 0 tested)
- `al-maraghi-icon-white.png` real asset from Fahim (blank placeholder)
- UAE trademark search (MOET eServices, Nice Classes 9/42)
- `roleTag` not yet in `BuilderField` TypeScript interface or Form Builder UI
- Receptionist KPI question-level tagging — parked
- Phase 2 kiosk/native app — parked, don't resume unless Fahim raises it
- `plate_categories` admin UI — SQL-only for now
- Notification recipient picker end-to-end verification
- Google review click + QR-shown tracking verification on real submission
- `interaction_metadata` payload verification on real submission

---

## KEY CONSTANTS

- Roles (descending): super_admin → ceo → agm → manager → receptionist. super_admin/ceo always full access, no exceptions.
- Scoring: star=`(rating/5)*100`, MC=option score, numeric_scale=`((val-1)/9)*100`, weighted, sums to 100 per form. Skipped questions excluded from denominator. Server-side only.
- Google review threshold: 90% default, server-side, client gets `showQr` boolean
- Facility singleton ID: `00000000-0000-0000-0000-000000000000`
- Domain: `muhimmak.misalm.com`
- No dashes in UI copy
- Eastern Arabic numerals in Arabic mode except PIN entry/display
- DeepSeek model: `deepseek-v4-flash` only
- No raw IDs/hashes in UI
- `/feedback` (PublicFeedbackClient.tsx) always light theme — never touch for dark mode
- All routes are thin wrappers calling service functions in `src/server/services/`
- Every service file has `'server-only'` as first line
- `createAdminClient()` for all writes bypassing RLS

---

## AVERAGE DB CALLS PER ROUTE (for latency context)

| Route | DB Calls |
|---|---|
| `/dashboard` | 8–9 |
| `/dashboard/sessions` | 4 |
| `/dashboard/sessions/[id]` | 7–14 |
| `/feedback/[token]` | 3 |
| `/api/v1/sessions/update` | 7–9 |

Frankfurt + Frankfurt = ~1ms per call. Previously Mumbai + Frankfurt = ~120ms per call × 8+ calls = significant latency.
