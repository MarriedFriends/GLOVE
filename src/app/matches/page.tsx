import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { FACE_OPTIONS } from "@/lib/onboarding-options";

export default async function MatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS already limits this to matches I participate in.
  const { data: matches } = await supabase
    .from("matches")
    .select("id, user_low, user_high, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const otherIds = (matches ?? []).map((m) =>
    m.user_low === user.id ? m.user_high : m.user_low,
  );

  // Profiles and message previews are independent — fetch in parallel.
  const matchIds = (matches ?? []).map((m) => m.id);
  const [profilesRes, lastMessagesRes] = await Promise.all([
    otherIds.length
      ? supabase
          .from("profiles")
          .select("id, handle, face_type, mbti")
          .in("id", otherIds)
      : Promise.resolve({ data: [] }),
    matchIds.length
      ? supabase
          .from("messages")
          .select("match_id, content, created_at")
          .in("match_id", matchIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = profilesRes.data;
  const lastMessages = lastMessagesRes.data;

  const rows = (matches ?? []).map((m) => {
    const otherId = m.user_low === user.id ? m.user_high : m.user_low;
    const other = (profiles ?? []).find((p) => p.id === otherId);
    const last = (lastMessages ?? []).find((msg) => msg.match_id === m.id);
    return { match: m, other, last };
  });

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
            내 매칭
          </p>
          <span className="w-10" />
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-black/[.08] bg-white/60 p-8 text-center dark:border-white/[.12] dark:bg-white/[.03]">
            <p className="text-4xl">💌</p>
            <p className="mt-3 font-semibold text-zinc-900 dark:text-white">
              아직 매칭된 상대가 없어요
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              오늘의 추천에서 좋아요를 보내보세요. 서로 좋아요를 누르면 여기서
              채팅이 시작돼요!
            </p>
            <Link
              href="/discover"
              className="mt-5 inline-block rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/30"
            >
              오늘의 추천 보러 가기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(({ match, other, last }) => (
              <Link
                key={match.id}
                href={`/chat/${match.id}`}
                className="flex items-center gap-3 rounded-2xl border border-black/[.08] bg-white/80 p-4 transition-colors hover:border-rose-300 dark:border-white/[.12] dark:bg-white/[.04] dark:hover:border-rose-700"
              >
                <span className="text-3xl">
                  {FACE_OPTIONS.find((o) => o.value === other?.face_type)
                    ?.emoji ?? "🙂"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {other?.handle ?? "알 수 없음"}
                    {other?.mbti && (
                      <span className="ml-2 text-xs font-medium text-zinc-400">
                        {other.mbti}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {last?.content ?? "첫 메시지를 보내보세요 👋"}
                  </p>
                </div>
                <span className="text-zinc-300 dark:text-zinc-600">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
