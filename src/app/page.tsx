import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // Server-side Supabase call — proves the integration is wired up.
  // Returns null until you sign in; the directory is gated by RLS.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-2xl flex-col justify-center gap-8 py-24 px-8">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium uppercase tracking-widest text-indigo-500">
            Campus Social
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Your university, all in one feed.
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            A Next.js 16 + Supabase starter. Auth, profiles, and a campus feed
            are scaffolded and ready to build on.
          </p>
        </div>

        <div className="rounded-xl border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                supabaseConfigured ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            <span className="font-medium text-black dark:text-zinc-50">
              Supabase{" "}
              {supabaseConfigured
                ? "connected"
                : "not configured yet"}
            </span>
          </div>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {supabaseConfigured ? (
              user ? (
                <>Signed in as {user.email}.</>
              ) : (
                <>No user session yet — add a login flow to sign in.</>
              )
            ) : (
              <>
                Add your project URL and anon key to{" "}
                <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono dark:bg-white/[.1]">
                  .env.local
                </code>
                , then run the SQL in{" "}
                <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono dark:bg-white/[.1]">
                  supabase/schema.sql
                </code>
                .
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
