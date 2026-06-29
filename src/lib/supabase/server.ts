import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers.
 *
 * NOTE: In Next.js 16 `cookies()` is async, so this factory is async too —
 * always `await createClient()`.
 *
 * A fresh client must be created per request because it is bound to that
 * request's cookies. Never store it in a module-level variable.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where setting
            // cookies is not allowed. This is safe to ignore because the
            // session is refreshed by the proxy (src/proxy.ts) on every
            // request before the Server Component renders.
          }
        },
      },
    },
  );
}
