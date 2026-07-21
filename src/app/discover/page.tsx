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

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender, admission_year, height_range, face_type, mbti")
    .eq("id", user.id)
    .single();
  if (!isProfileComplete(profile)) redirect("/onboarding");

  // No saved preferences yet → set them up first. (Full row: the list view
  // compares each candidate against these conditions to highlight matches.)
  const { data: prefs } = await supabase
    .from("match_preferences")
    .select("*")
    .eq("user_id", user.id)
    .eq("mode", "date")
    .maybeSingle();
  if (!prefs) redirect("/find");

  const { data: candidates, error: rpcError } = await supabase.rpc(
    "find_candidates",
    { max_results: 3 },
  );

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
              서로 좋아요를 눌렀어요. 채팅 기능이 곧 열릴 예정이에요 💬
            </p>
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
              조건에 맞는 상대가 아직 없어요
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              나이·키 범위를 넓히거나 &ldquo;다른 학교도 좋아요&rdquo;로 바꾸면
              더 많은 상대를 만날 수 있어요.
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
              배너를 누르면 상세 정보를 볼 수 있어요
            </p>
            <DiscoverList candidates={candidates} prefs={prefs} />
          </>
        )}
      </div>
    </div>
  );
}
