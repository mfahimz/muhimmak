# Muhimmak — Developer Guide

## Stack Overview

- **Framework & Language**: Next.js 16.2.7 (App Router, TypeScript, Tailwind CSS, `src/` directory structure)
- **Database & Auth**: Supabase (PostgreSQL + Auth, Frankfurt region)
- **UI Components**: shadcn/ui components
- **Hosting & Deployment**: Vercel
- **AI Integrations**: DeepSeek V4 Flash via OpenAI SDK (`@/server/lib/deepseek`) for AI features
- **Internationalization (i18n)**: `next-intl` for bilingual English (EN) and Arabic (AR) support
- **IDE & Execution**: Google Antigravity IDE as the execution agent

---

## Project Structure

- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/v1/` — Versioned API endpoints (thin wrappers only)
- `src/server/services/` — Core business logic layer (auth, forms, sessions, metrics)
- `src/server/lib/` — Server-only infrastructure utilities (DeepSeek singleton client)
- `src/lib/supabase/` — Supabase client factories (`server.ts`, `client.ts`, `admin.ts`)
- `src/lib/audit/` — Audit logging helpers
- `src/components/` — Reusable React UI components and layouts
- `messages/` — Internationalization translation files (`en.json`, `ar.json`)
- `scripts/` — Developer automation scripts (translation sync, i18n validation)
- `supabase/` — Database migration files and SQL definitions

---

## API Versioning

All API routes live under `/api/v1/`. Route files must remain thin wrappers that delegate execution directly to dedicated service functions in `src/server/services/`. Business logic must **never** be placed directly inside route handler files.

### Route File Pattern Example

```typescript
// src/app/api/v1/my-feature/route.ts
import { myFunction } from "@/server/services/my.service"

export async function POST(request: Request) {
  return myFunction(request)
}
```

---

## Procedures

### 1. Adding a New Page or Sub-page

1. **Create Page Component**: Create the page file at `src/app/dashboard/[pagename]/page.tsx`.
2. **Implement Server-Side Role Check**: Add a server-side role check at the top of `page.tsx`:
   ```typescript
   import { createClient as createServerClient } from "@/lib/supabase/server"
   import { createAdminClient } from "@/lib/supabase/admin"
   import { redirect } from "next/navigation"

   export default async function NewPage() {
     const supabase = await createServerClient()
     const { data: { user }, error } = await supabase.auth.getUser()
     if (error || !user) redirect("/login")

     const admin = createAdminClient()
     const { data: profile } = await admin
       .from("profiles")
       .select("role")
       .eq("id", user.id)
       .single()

     const role = profile?.role || "receptionist"
     const allowedRoles = ["super_admin", "ceo"]

     if (!allowedRoles.includes(role)) {
       redirect("/dashboard")
     }

     // Render page...
   }
   ```
3. **Configure Navigation Link**: Add the item to `ALL_NAV_ITEMS` in `src/components/app-sidebar.tsx`:
   ```typescript
   {
     title: "NewPage",
     url: "/dashboard/new-page",
     icon: IconComponent,
     roles: ["super_admin", "ceo"],
   }
   ```
4. **Register Database Resource**: Insert the new resource into the `resources` table via the Supabase SQL Editor:
   ```sql
   INSERT INTO resources (id, label) VALUES ('new_page', 'New Page');
   ```
5. **Add Role Permissions**: Insert default `role_permissions` rows for every existing role (`receptionist`, `manager`, `agm`, `ceo`):
   ```sql
   INSERT INTO role_permissions (role, resource_id, can_view, can_create, can_update, can_delete, can_view_sensitive)
   VALUES
     ('receptionist', 'new_page', false, false, false, false, false),
     ('manager', 'new_page', false, false, false, false, false),
     ('agm', 'new_page', true, false, false, false, false),
     ('ceo', 'new_page', true, true, true, true, true);
   ```
6. **Update Static Permissions Object**: Add the `new_page` key to the `PERMISSIONS` object in `src/app/dashboard/settings/SettingsClient.tsx` matching DB values exactly.
7. **Update Resources List**: Add `{ id: 'new_page', label: 'New Page' }` to the `RESOURCES` array in `SettingsClient.tsx`.
8. **Add English i18n Keys**: Add any new text keys to `messages/en.json`.
9. **Translate to Arabic**: Run `node scripts/translate-messages.js`.
10. **Validate Translations**: Run `node scripts/check-arabic-completeness.js` and confirm 0 missing keys.
11. **Verify Build**: Run `npm run build` and confirm 0 errors.

---

### 2. Adding a New Feature to an Existing Page

1. **Determine Permission Scope**:
   - If the feature requires dedicated access controls (e.g., bulk delete or export): register a new resource in Supabase, add `role_permissions` rows, and update `RESOURCES` & `PERMISSIONS` in `SettingsClient.tsx`.
   - If the feature inherits the existing page permission: no database permission changes are required.
2. **AI Integration Rules (if applicable)**:
   - Always import the singleton: `import { deepseek, DEEPSEEK_MODEL } from '@/server/lib/deepseek'`.
   - Never instantiate `new OpenAI()` directly inside feature code.
   - Always perform AI calls server-side inside `src/server/services/`.
   - Include retry logic with a minimum 1-second delay for transient API errors.
3. **Add API Endpoints**:
   - Create a thin route file under `src/app/api/v1/[domain]/route.ts`.
   - Delegate all logic to a service file under `src/server/services/`.
4. **Manage i18n**:
   - Add new strings to `messages/en.json`.
   - Run `node scripts/translate-messages.js`.
5. **Verify Build**: Run `npm run build` and confirm 0 errors.

---

### 3. Adding a New User Role

1. **Update Database Role Constraint**:
   ```sql
   ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
   ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
   CHECK (role IN ('super_admin', 'ceo', 'agm', 'manager', 'receptionist', 'new_role'));
   ```
2. **Insert Permission Records**: Add `role_permissions` rows for every existing resource for the new role:
   ```sql
   INSERT INTO role_permissions (role, resource_id, can_view, can_create, can_update, can_delete, can_view_sensitive)
   VALUES
     ('new_role', 'dashboard', true, false, false, false, false),
     ('new_role', 'forms', false, false, false, false, false),
     ('new_role', 'sessions', true, true, false, false, false),
     ('new_role', 'settings', false, false, false, false, false),
     ('new_role', 'users', false, false, false, false, false),
     ('new_role', 'detailed_reports', false, false, false, false, false);
   ```
3. **Update Client Roles Array**: Add `'new_role'` to `ROLES` in `src/app/dashboard/settings/SettingsClient.tsx`:
   ```typescript
   const ROLES = ['receptionist', 'manager', 'agm', 'ceo', 'new_role'] as const;
   ```
4. **Update Client Permissions Object**: Add the `new_role` entry to the `PERMISSIONS` object in `SettingsClient.tsx`.
5. **Update Page Guards**: Add `'new_role'` to `allowedRoles` arrays in `page.tsx` files where applicable.
6. **Update Sidebar Navigation**: Add `'new_role'` to item `roles` arrays in `src/components/app-sidebar.tsx` as appropriate.
7. **Add i18n Role Label**: Add `"roleNewRole": "New Role Display Name"` under `"Settings"` in `messages/en.json`.
8. **Sync & Validate i18n**:
   - Run `node scripts/translate-messages.js`
   - Run `node scripts/check-arabic-completeness.js`
9. **Verify Build**: Run `npm run build` and confirm 0 errors.

---

### 4. Removing a User Role

1. **Remove Role from Settings UI**:
   - Remove the role from the `ROLES` array in `SettingsClient.tsx`.
   - Remove the role block from the `PERMISSIONS` object in `SettingsClient.tsx`.
2. **Remove Role from Page Guards**: Remove the role from `allowedRoles` arrays across all `page.tsx` files.
3. **Remove Role from Sidebar**: Remove the role from item `roles` arrays in `src/components/app-sidebar.tsx`.
4. **Delete Permission Records from Supabase**:
   ```sql
   DELETE FROM role_permissions WHERE role = 'old_role';
   ```
5. **Update Database Role Constraint**:
   ```sql
   ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
   ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
   CHECK (role IN ('super_admin', 'ceo', 'agm', 'manager', 'receptionist'));
   ```
6. **Clean Up i18n Keys**: Remove the role's translation keys from `messages/en.json` and `messages/ar.json`.
7. **Validate i18n & Build**:
   - Run `node scripts/check-arabic-completeness.js`
   - Run `npm run build` and confirm 0 errors.

---

### 5. i18n — Adding New Translation Keys

- **Source of Truth**: Always add new translation keys to `messages/en.json` first.
- **Automated Arabic Sync**: Never add or edit keys in `ar.json` directly. Always run:
  ```bash
  node scripts/translate-messages.js
  ```
  *(Requires `DEEPSEEK_API_KEY` in `.env.local`)*
- **Completeness Verification**: After running the translation script, verify key parity with:
  ```bash
  node scripts/check-arabic-completeness.js
  ```
- **Coverage**: Every new page, component, badge, or modal text must have corresponding entries in both `en.json` and `ar.json`.

---

### 6. Database Changes

> [!IMPORTANT]
> **Hard Rule**: All database schema changes must be executed as raw SQL via the **Supabase Dashboard SQL Editor**. Do not use Supabase CLI migrations or automated runtime SQL DDL execution.

- **RLS Enactment**: Row Level Security (RLS) must be enabled on every table.
- **Permission Checking**: Security policies should call `has_permission(resource_id, action)` rather than hardcoding role strings.
- **Service Role Grants**: Ensure explicit `GRANT` statements are assigned to `service_role`.
- **Type Regeneration**: Check whether TypeScript definitions in `@/lib/supabase/` require manual interface updates after DDL alterations.

---

### 7. Before Every Git Push Checklist

- [ ] `npm run build` succeeds with zero errors or warnings.
- [ ] `node scripts/check-arabic-completeness.js` reports 0 missing keys between `en.json` and `ar.json`.
- [ ] Code is free of temporary `console.log` timers, debugging outputs, or commented-out blocks.
- [ ] Code contains zero unused imports.
- [ ] All API routes are located under `/api/v1/` and structured as thin handler wrappers.
- [ ] Business logic resides in `src/server/services/`.
- [ ] Version in `package.json` is incremented according to semantic versioning when pushing features.
- [ ] Commit message clearly describes the technical scope of the changes.
