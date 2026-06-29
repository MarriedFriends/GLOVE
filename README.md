# Campus Social

A social app for university communities, built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Supabase**.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a project at [supabase.com](https://supabase.com), then copy your credentials into `.env.local`:

```bash
cp .env.example .env.local
```

Fill in (Dashboard → Project Settings → Data API / API Keys):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Create the database schema

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It sets up the `profiles`, `likes`, `matches`, `messages`, `blocks`, and `reports` tables, row-level security policies, the mutual-like → match trigger, the profile-on-sign-up trigger, and Realtime on `messages`.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The homepage shows a live Supabase connection status.

## How Supabase is wired up

| File | Purpose |
| --- | --- |
| `src/lib/supabase/client.ts` | Browser client for Client Components (`"use client"`). |
| `src/lib/supabase/server.ts` | Server client for Server Components, Actions, and Route Handlers. `cookies()` is async in Next.js 16, so this factory is async — `await createClient()`. |
| `src/lib/supabase/proxy.ts` | Session-refresh logic and the protected-route gate. |
| `src/proxy.ts` | The proxy entry point. |
| `src/lib/supabase/database.types.ts` | Database types. Regenerate with `supabase gen types`. |

> **Next.js 16 note:** the `middleware` file convention was renamed to **`proxy`**. The Supabase auth-refresh logic that older guides place in `middleware.ts` lives in `src/proxy.ts` here. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

## Next steps

- Build `/login` and `/signup` routes with student-email verification (the proxy already redirects unauthenticated users there).
- Build the onboarding flow that fills in `handle`, `gender`, `interested_in` on the auto-created profile.
- Build the discovery/swipe surface (writes to `likes`; a mutual like auto-creates a `match`).
- Build the chat UI on `messages`, subscribed via Supabase Realtime, scoped to a match.
