# server/

Server-side only code. Never import from client components.

## Structure

- `lib/deepseek.ts` — DeepSeek/OpenAI singleton client
- `services/` — Business logic, one file per domain (auth, forms, sessions)

## API versioning

All API routes live under /api/v1/. This is the contract the web app
and future iPad app both call.
