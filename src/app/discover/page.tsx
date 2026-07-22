import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/lib/profile";
import { DiscoverList } from "./DiscoverList";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ matched?: string; error?: string }>;
}) {
  const { matched, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Independent queries — run in parallel to cut page latency.
  const [profileRes, prefsRes, candidatesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("gender, admission_year, height_range, face_type, mbti")
      .eq("id", user.id)
      .single(),
    supabase
      .from("match_preferences")
      .select("*")
      .eq("user_id", user.id)
      .eq("mode", "date")
      .maybeSingle(),
    supabase.rpc("get_daily_candidates"),
  ]);

  if (!isProfileComplete(profileRes.data)) redirect("/onboarding");

  // No saved preferences yet → set them up first. (Full row: the list view
  // compares each candidate against these conditions to highlight matches.)
  const prefs = prefsRes.data;
  if (!prefs) redirect("/find");

  const { data: candidates, error: rpcError } = candidatesRes;

  return (
    <div className="flex flex-1 justify-center bg-gradient-to-b from-rose-50 via-white to-white px-6 py-12 font-sans dark:from-rose-950/30 dark:via-black dark:to-black">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
          >
            ← 홈
          </Link>
          <p className="text-sm font-medium uppercase tracking-widest text-rose-500">
            오늘의 추천
          </p>
          <Link
            href="/find"
            className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
          >
            조건 수정
          </Link>
        </div>

        {matched && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 p-5 text-center text-white shadow-lg shadow-rose-500/30">
            <p className="text-3xl">🎉</p>
            <p className="mt-1 text-lg font-bold">
              {matched} 님과 매칭됐어요!
            </p>
            <p className="mt-1 text-sm text-rose-100">
              서로 좋아요를 눌렀어요!
            </p>
            <Link
              href="/matches"
              className="mt-3 inline-block rounded-full bg-white px-5 py-2 text-sm font-bold text-rose-500"
            >
              💬 지금 채팅하러 가기
            </Link>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {rpcError ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <p className="font-semibold">매칭 엔진이 아직 준비되지 않았어요</p>
            <p className="mt-1">
              Supabase SQL Editor에서 <code>supabase/schema.sql</code>을 다시
              실행해주세요. (find_candidates 함수가 필요해요)
            </p>
            <p className="mt-2 text-xs opacity-70">{rpcError.message}</p>
          </div>
        ) : !candidates || candidates.length === 0 ? (
          <div className="rounded-2xl border border-black/[.08] bg-white/60 p-8 text-center dark:border-white/[.12] dark:bg-white/[.03]">
            <p className="text-4xl">🔭</p>
            <p className="mt-3 font-semibold text-zinc-900 dark:text-white">
              오늘은 조건에 맞는 상대를 찾지 못했어요
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              내일 아침 9시에 다시 찾아드릴게요. 나이·키 범위를 넓히거나
              &ldquo;다른 학교도 좋아요&rdquo;로 바꾸면 만날 확률이 올라가요.
            </p>
            <Link
              href="/find"
              className="mt-5 inline-block rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/30"
            >
              조건 다시 설정하기
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              매일 아침 9시, 새로운 3명이 찾아와요 · 배너를 누르면 상세 정보
            </p>
            <DiscoverList candidates={candidates} prefs={prefs} />
          </>
        )}
      </div>
    </div>
  );
}
