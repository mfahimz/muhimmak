@AGENTS.md

# Quick Reference for Claude & AI Agents

## Core Principles
1. **Thin API Handlers**: All API routes live under `src/app/api/v1/` and only wrap service calls in `src/server/services/`.
2. **Server Isolation**: Server code in `src/server/` must never be imported in client components (`"use client"`).
3. **AI Singleton**: AI features must use `import { deepseek, DEEPSEEK_MODEL } from "@/server/lib/deepseek"`.
4. **i18n Workflow**: Add keys to `messages/en.json` -> Run `node scripts/translate-messages.js` -> Verify with `node scripts/check-arabic-completeness.js`. Never edit `ar.json` directly.
5. **Database RLS & Grants**: Ensure RLS is enabled and every table grant includes both `authenticated` and `service_role`.
6. **Next.js 16 Async Props**: Always `await params` and `await searchParams` in page/layout components.

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Verify production build (must be 0 errors)
- `node scripts/translate-messages.js` — Translate EN to AR
- `node scripts/check-arabic-completeness.js` — Verify i18n key completeness

## Pre-Push Checklist
- [ ] `npm run build` passes cleanly
- [ ] `node scripts/check-arabic-completeness.js` shows 0 missing keys
- [ ] No dead imports or `console.log` leftovers
