import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/lib/profile";
import { FACE_OPTIONS } from "@/lib/onboarding-options";
import { signout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged in but hasn't finished the survey → send them there.
  // The three queries are independent — run them in parallel (one round trip
  // of latency instead of three).
  let profile = null;
  let hasDatePrefs = false;
  let matchCount = 0;
  if (user) {
    const [profileRes, prefsRes, matchRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("match_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("mode", "date")
        .maybeSingle(),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);
    profile = profileRes.data;
    if (!isProfileComplete(profile)) redirect("/onboarding");
    hasDatePrefs = Boolean(prefsRes.data);
    matchCount = matchRes.count ?? 0;
  }

  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const thisYear = new Date().getFullYear();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-rose-50 via-white to-white px-6 font-sans dark:from-rose-950/30 dark:via-black dark:to-black">
      {/* Soft glow behind the logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-rose-300/40 blur-3xl dark:bg-rose-700/20"
      />

      <main className="relative z-10 flex w-full max-w-md flex-col items-center gap-10 py-20 text-center">
        <div className="flex flex-col items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 text-3xl shadow-lg shadow-rose-500/30">
            🧤
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Glove
            </h1>
            <p className="mt-3 text-lg leading-7 text-zinc-600 dark:text-zinc-400">
              같은 캠퍼스, 익명으로 시작하는 설렘.
              <br />
              마음이 통하면 그때 대화를 시작해요.
            </p>
          </div>
        </div>

        {user && profile ? (
          <div className="flex w-full flex-col items-center gap-4">
            {/* Find buttons */}
            <div className="grid w-full grid-cols-2 gap-3">
              <Link
                href={hasDatePrefs ? "/discover" : "/find"}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 px-4 py-5 text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02]"
              >
                <span className="text-3xl">💘</span>
                <span className="text-sm font-semibold">
                  {hasDatePrefs ? "오늘의 추천 보기" : "이성 찾기"}
                </span>
              </Link>
              <div className="relative flex flex-col items-center gap-1.5 rounded-2xl border border-black/[.08] bg-white/60 px-4 py-5 text-zinc-400 dark:border-white/[.12] dark:bg-white/[.03] dark:text-zinc-500">
                <span className="text-3xl opacity-50">🤝</span>
                <span className="text-sm font-semibold">친구 찾기</span>
                <span className="absolute right-3 top-3 rounded-full bg-black/[.06] px-2 py-0.5 text-[10px] font-medium dark:bg-white/[.1]">
                  준비 중
                </span>
              </div>
            </div>

            <Link
              href="/matches"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/[.08] bg-white/60 px-4 py-3.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-rose-300 dark:border-white/[.12] dark:bg-white/[.03] dark:text-zinc-200 dark:hover:border-rose-700"
            >
              💬 내 매칭
              {matchCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                  {matchCount}
                </span>
              )}
            </Link>

            <div className="w-full rounded-2xl border border-black/[.08] bg-white/60 p-5 text-left dark:border-white/[.12] dark:bg-white/[.03]">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {FACE_OPTIONS.find((o) => o.value === profile.face_type)
                    ?.emoji ?? "🙂"}
                </span>
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {profile.handle}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {profile.birth_year
                      ? `${thisYear - profile.birth_year}세`
                      : ""}
                    {profile.admission_year
                      ? ` · ${String(profile.admission_year).slice(2)}학번`
                      : ""}
                    {profile.mbti ? ` · ${profile.mbti}` : ""}
                  </p>
                </div>
              </div>
              {profile.hobbies.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.hobbies.map((h) => (
                    <span
                      key={h}
                      className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex w-full gap-2">
              <Link
                href="/onboarding"
                className="flex-1 rounded-full border border-black/[.12] px-4 py-3 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.15] dark:text-zinc-200 dark:hover:bg-white/[.06]"
              >
                프로필 수정
              </Link>
              <form action={signout} className="flex-1">
                <button className="w-full rounded-full border border-black/[.12] px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.15] dark:text-zinc-200 dark:hover:bg-white/[.06]">
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02]"
          >
            시작하기
          </Link>
        )}

        {/* Small dev indicator — remove before launch */}
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          <span
            className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
              supabaseConfigured ? "bg-green-500" : "bg-amber-500"
            }`}
          />
          {supabaseConfigured ? "Supabase 연결됨" : "Supabase 미설정"}
        </p>
      </main>
    </div>
  );
}
