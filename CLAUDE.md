@AGENTS.md

# Glove

An **anonymous chat & dating (matchmaking) app for university students**. The
core experience is: students match with each other and chat anonymously — real
identities are hidden by default and only revealed if both users choose to.
Small team (3 collaborators), so keep things consistent and easy to read over
clever.

## Product principles (these shape every technical decision)

- **Anonymous by default.** A user's real name, email, and any identifying info
  must never be exposed to other users through the API, the client bundle, or
  realtime payloads. Other users see only a display handle/profile a user opts
  to show. Treat any leak of identity as a security bug, not a UI bug.
- **Verified students only.** Sign-up should be gated to real university
  members (e.g. `.ac.kr` / `.edu` email verification). Keep the verified email
  server-side; never send it to other clients.
- **Matchmaking + chat are the main surfaces.** Profiles, matches, and chat
  threads are the primary data models — build around them.
- **Safety matters.** Plan for blocking, reporting, and rate limiting from the
  start; anonymous dating apps attract abuse.

## Tech stack

- **Next.js 16** (App Router) — note `middleware` is now `proxy` (see AGENTS.md).
- **React 19** + **TypeScript** (strict mode).
- **Tailwind CSS v4** — config lives in `globals.css` via `@theme`, not a JS config file.
- **Supabase** — auth + Postgres + RLS. Clients in `src/lib/supabase/`.
- **Vercel** — deploy target. Anything that must run per-request can't be statically cached.

## Folder structure

```
src/
  app/                  # routes (App Router). One folder per route segment.
    layout.tsx          # root layout
    page.tsx            # route UI (Server Component by default)
  lib/
    supabase/           # all Supabase wiring lives here, nowhere else
      client.ts         # browser client — Client Components only
      server.ts         # server client — Server Components / Actions / Route Handlers
      proxy.ts          # session refresh + route guard logic
      database.types.ts # generated DB types
  proxy.ts              # proxy entry point (formerly middleware.ts)
supabase/
  schema.sql            # source of truth for tables, RLS, triggers
```

Rules:
- Feature routes go under `src/app/<feature>/`. Co-locate route-only components in that folder; promote to `src/components/` (create it) only when shared across routes.
- Never import `server.ts` into a Client Component, or `client.ts` into a Server Component.
- Use the `@/` path alias (`@/lib/...`), not deep relative imports.

## Coding conventions

- **TypeScript:** strict mode is on. No `any` — use `unknown` and narrow, or type it properly. Let return types infer unless exporting a public API.
- **Components:** Server Components by default. Add `"use client"` only when you need state, effects, or browser APIs — and keep those components small and leaf-level.
- **Supabase access:**
  - Server side: `const supabase = await createClient()` (it's async — `cookies()` is async in Next.js 16).
  - Always use `supabase.auth.getUser()` (revalidates the token), never `getSession()`, for auth checks on the server.
  - Don't trust the client — enforce access with **RLS policies** in `supabase/schema.sql`, not just UI checks.
- **Data mutations:** prefer Server Actions or Route Handlers over client-side writes.
- **Styling:** Tailwind utility classes inline. Support dark mode (`dark:` variants) — the app already does.
- **Naming:** components `PascalCase`, files for components `PascalCase.tsx`, everything else `kebab-case` or `camelCase`. DB columns `snake_case` (matches Postgres).
- **Env vars:** browser-exposed vars must be prefixed `NEXT_PUBLIC_`. Never commit secrets — `.env.local` is gitignored; keep `.env.example` updated when adding new vars.

## Schema changes

`supabase/schema.sql` is the source of truth. When you change tables:
1. Edit `schema.sql` (including RLS policies).
2. Regenerate types: `npx supabase gen types typescript ... > src/lib/supabase/database.types.ts`.

## Before pushing

Run all three — they gate the build on Vercel:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Team workflow

- Branch per feature; open a PR for review (3-person team, so a second pair of eyes is cheap).
- Keep PRs small and focused.
- Don't commit `.env.local` or real Supabase keys.
