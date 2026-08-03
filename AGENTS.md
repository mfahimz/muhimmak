<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Muhimmak (`al-maraghi-feedback`) — AI Agent Operating Instructions

This file serves as the definitive reference for AI agents working on the Muhimmak repository. All AI assistants must adhere strictly to these architectural patterns, security requirements, and operational procedures.

---

## 1. Core Technology Stack

- **Framework**: Next.js 16.2 (App Router, TypeScript, Tailwind CSS v4)
- **Database & Auth**: Supabase (PostgreSQL + Auth, Frankfurt region)
- **UI Components**: `shadcn/ui` + Lucide React + Recharts
- **Internationalization (i18n)**: `next-intl` (Bilingual English `en` & Arabic `ar`)
- **AI Integrations**: DeepSeek V4 Flash via OpenAI SDK (`@/server/lib/deepseek`)
- **Hosting & Deployment**: Vercel

---

## 2. Mandatory Architectural Guidelines

### 2.1 API Route Handlers (`/api/v1/`)
- All public/external and application API routes **MUST** be placed under `src/app/api/v1/`.
- API route files **MUST remain thin handler wrappers ONLY**.
- **NO business logic, SQL queries, or complex data processing** is permitted directly inside route handler files.
- Route handlers must parse input, call the appropriate service function from `src/server/services/`, and return the `NextResponse` JSON.

```typescript
// ✅ CORRECT: Thin wrapper in src/app/api/v1/feature/route.ts
import { myFeatureService } from "@/server/services/feature.service"

export async function POST(request: Request) {
  return myFeatureService(request)
}
```

### 2.2 Business Logic & Server Isolation (`src/server/`)
- All core business logic, data formatting, domain calculations, and database integrations **MUST** reside in domain-specific services inside `src/server/services/`.
- `src/server/` contains server-only code. **NEVER** import any file from `src/server/` into client components (`"use client"`).

### 2.3 AI Integration Rules (`@/server/lib/deepseek`)
- Always import the singleton DeepSeek client:
  ```typescript
  import { deepseek, DEEPSEEK_MODEL } from "@/server/lib/deepseek"
  ```
- **NEVER** instantiate `new OpenAI()` directly inside feature or component code.
- Always execute AI calls server-side within `src/server/services/`.
- Include retry logic with a minimum 1-second delay for transient API errors.

### 2.4 Supabase Client Usage (`@/lib/supabase/`)
- **Server Components & API Services**: Use `createServerClient()` from `@/lib/supabase/server`.
- **Admin / Privileged Tasks**: Use `createAdminClient()` from `@/lib/supabase/admin`.
- **Client Components**: Use `createClient()` from `@/lib/supabase/client`.

---

## 3. Next.js 16 App Router Conventions

- **Async Dynamic Parameters**: In Next.js 16, `params` and `searchParams` in Page and Layout components are `Promise` objects. You **MUST** await them before accessing properties:
  ```typescript
  // ✅ CORRECT in Next.js 16
  export default async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }) {
    const { id } = await params
    const { page } = await searchParams
    // ...
  }
  ```
- **Client Directives**: Place `"use client"` at the very top of interactive UI components that utilize React hooks (`useState`, `useEffect`, `useTranslations`).

---

## 4. Internationalization (i18n) Workflow

- **Source of Truth**: All user-facing UI text keys must be added to `messages/en.json` first.
- **Automated Arabic Sync**: **NEVER** manually create or edit keys directly in `messages/ar.json`.
- **Sync Command**: After adding English keys to `messages/en.json`, run:
  ```bash
  node scripts/translate-messages.js
  ```
  *(Note: Requires `DEEPSEEK_API_KEY` in `.env.local`)*
- **Completeness Verification**: Verify translation key parity by running:
  ```bash
  node scripts/check-arabic-completeness.js
  ```
  Target: **0 missing keys**.

---

## 5. Database & Supabase Security Standards

- **Raw SQL Execution**: All schema changes and migrations must be written as valid PostgreSQL DDL statements under `supabase/migrations/` and executed via the Supabase Dashboard SQL Editor.
- **Row Level Security (RLS)**: Mandatory on ALL public tables (`alter table public.<table_name> enable row level security;`).
- **Permission Checking**: Security policies should invoke `has_permission(resource_id, action)` rather than hardcoding role strings where applicable.
- **Mandatory Table Grants**: Every SQL table creation or alteration **MUST** conclude with explicit GRANT statements for both roles:
  ```sql
  alter table public.<table_name> enable row level security;
  grant select, insert, update, delete on public.<table_name> to authenticated;
  grant all on public.<table_name> to service_role;
  ```
- **Role-Based Access Control (RBAC)**: Supported roles in `profiles` table: `super_admin`, `ceo`, `agm`, `manager`, `receptionist`.

---

## 6. Common Procedures

### Adding a New Page or Sub-page
1. Create page component at `src/app/dashboard/[pagename]/page.tsx`.
2. Implement server-side role check & user authentication guard.
3. Register menu item in `ALL_NAV_ITEMS` in `src/components/app-sidebar.tsx`.
4. Register resource in `resources` table and set `role_permissions` in Supabase.
5. Update `RESOURCES` and `PERMISSIONS` in `src/app/dashboard/settings/SettingsClient.tsx`.
6. Add English UI strings to `messages/en.json`.
7. Run `node scripts/translate-messages.js` and `node scripts/check-arabic-completeness.js`.
8. Verify zero build errors with `npm run build`.

---

## 7. Developer Commands & Workflows

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start Next.js local development server |
| `npm run build` | Run production build & TypeScript type checking |
| `npm run lint` | Run ESLint checks |
| `node scripts/translate-messages.js` | Auto-translate English keys from `en.json` to `ar.json` |
| `node scripts/check-arabic-completeness.js` | Validate i18n key parity between `en.json` and `ar.json` |

---

## 8. Pre-Flight Checklist (Run Before Completing Any Task)

- [ ] `npm run build` succeeds with zero errors or warnings.
- [ ] `node scripts/check-arabic-completeness.js` reports 0 missing keys.
- [ ] No temporary `console.log` statements or unused imports remain.
- [ ] API endpoints are located under `/api/v1/` as thin wrappers around service functions.
- [ ] Business logic resides exclusively in `src/server/services/`.
- [ ] DB tables have explicit RLS and `GRANT` footers for `authenticated` and `service_role`.
