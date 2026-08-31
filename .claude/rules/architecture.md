# Architecture rules

## Stack

- Next.js 16 App Router (TypeScript, Tailwind, `src/`)
- Supabase (PostgreSQL + Auth, Frankfurt eu-central-1)
- Vercel (Hobby plan, Frankfurt — co-located with Supabase)
- Resend (email, `muhimmak.misalm.com` domain verified, eu-west-1, free
  tier 100/day)
- DeepSeek V4 Flash (AI — model `deepseek-v4-flash`, thinking disabled,
  OpenAI-SDK compatible, baseURL `https://api.deepseek.com`)
- next-intl (i18n, cookie-based, no URL prefixes)
- recharts + shadcn/ui, next-themes
- GitHub: `github.com/mfahimz/muhimmak`, main branch

## Core principles (hard rules, not suggestions)

- DeepSeek only runs at build/admin time — NEVER live during
  customer-facing moments (see key-constants.md for latency reasoning)
- All service files begin with `'server-only'` as the first line
- `createAdminClient()` for all writes that need to bypass RLS
- RLS enabled on every table; policies call `has_permission(resource,
  action)` — never hardcode role checks. Documented exception:
  `support_tickets` and `support_ticket_comments` use hardcoded role
  checks (`role in ('super_admin','ceo')`), intentional, do not "fix"
- Every migration footer: enable RLS + `GRANT` to both `authenticated`
  and `service_role` — but only grant what's actually needed (don't
  grant insert/update/delete to authenticated if no policy or UI uses
  it yet — dead grants are clutter, and reviewed as such)
- No raw IDs/UUIDs ever visible in UI
- No dashes in UI copy, app-wide
- Eastern Arabic numerals in Arabic mode (exceptions: PIN entry,
  generated-PIN display modal)
- All routes are thin wrappers calling service functions in
  `src/server/services/`

## i18n gotcha (recurring, always check)

`check-arabic-completeness.js` only checks EN/AR parity, NOT that a new
namespace actually exists. After adding any new UI string: grep the new
namespace key directly in BOTH `en.json` and `ar.json` — don't trust the
scanner alone. After any `en.json`/`ar.json` edit, restart `npm run dev`
(not browser refresh) to clear the Next.js module cache.

## Form versioning is sacred

Editing a live form with existing responses via the Form Builder UI save
path correctly clones to a new UUID and closes the old version, preserving
response linkage to the version that was live when they answered. A raw
SQL UPDATE on the `fields` JSONB column does NOT break foreign keys but
WILL silently corrupt historical response accuracy. Always use the UI
save path for any live-form edit with existing responses.

## Plate number handling

- AES-256-CBC encryption (`ENCRYPTION_KEY`) for display/decryption,
  format `iv_hex:ciphertext_hex`
- HMAC-SHA256 hash (`PLATE_HASH_SECRET`) for duplicate detection — fully
  deterministic (same plate always produces same hash, no salt/nonce),
  reusable pattern for any "have we seen this plate before" feature
- `plate_number_hash` stored directly on `sessions`,
  `public_submission_log`, and `visit_closures` tables (no separate
  `vehicles` table exists)
- `decryptPlate` detects `iv:ciphertext` format vs legacy plaintext rows
