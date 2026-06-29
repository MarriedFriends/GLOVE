import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";

/**
 * Refreshes the Supabase auth session on every matched request and keeps the
 * auth cookies in sync between the browser and Server Components.
 *
 * This is the logic the Supabase docs put in `middleware.ts`. In Next.js 16
 * the `middleware` file convention was renamed to `proxy`, so this is wired up
 * from `src/proxy.ts` instead.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run code between `createServerClient` and
  // `supabase.auth.getUser()`. A simple mistake here can make it very hard to
  // debug issues with users being randomly logged out.
  //
  // `getUser()` revalidates the token with the Supabase Auth server, unlike
  // `getSession()` which only reads it from the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Example gate: redirect unauthenticated users away from protected routes.
  // Adjust the allowlist to fit the campus-social app's public pages.
  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // IMPORTANT: Return `supabaseResponse` as-is. If you create a new response,
  // copy over its cookies, or the session will fall out of sync.
  return supabaseResponse;
}
