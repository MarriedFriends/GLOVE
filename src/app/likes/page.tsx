import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { FACE_OPTIONS, formatHeight } from "@/lib/onboarding-options";
import { acceptLike } from "./actions";

export default async function LikesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [likesRes, matchesRes] = await Promise.all([
    supabase
      .from("likes")
      .select("liker_id, created_at")
      .eq("likee_id", user.id)
      .eq("is_like", true)
      .order("created_at", { ascending: false }),
    supabase.from("matches").select("user_low, user_high"),
  ]);

  // Hide likes that already became a match (any status).
  const matchedIds = new Set(
    (matchesRes.data ?? []).flatMap((m) => [m.user_low, m.user_high]),
  );
  const pending = (likesRes.data ?? []).filter(
    (l) => !matchedIds.has(l.liker_id),
  );

  const { data: profiles } = pending.length
    ? await supabase
        .from("profiles")
        .select(
          "id, handle, face_type, mbti, birth_year, admission_year, height_range, hobbies, university",
        )
        .in(
          "id",
          pending.map((l) => l.liker_id),
        )
    : { data: [] };

  const thisYear = new Date().getFullYear();
  // Blocked/inactive likers are filtered out by RLS on profiles.
  const likers = pending
    .map((l) => (profiles ?? []).find((p) => p.id === l.liker_id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

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
            나를 좋아한 사람
          </p>
          <span className="w-10" />
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {likers.length === 0 ? (
          <div className="rounded-2xl border border-black/[.08] bg-white/60 p-8 text-center dark:border-white/[.12] dark:bg-white/[.03]">
            <p className="text-4xl">💌</p>
            <p className="mt-3 font-semibold text-zinc-900 dark:text-white">
              아직 받은 좋아요가 없어요
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              누군가 나에게 좋아요를 보내면 여기에 나타나요.
              <br />
              수락하면 바로 채팅이 시작돼요!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {likers.map((p) => {
              const face = FACE_OPTIONS.find((o) => o.value === p.face_type);
              return (
                <div
                  key={p.id}
                  className="rounded-3xl border border-black/[.08] bg-white/80 p-5 dark:border-white/[.12] dark:bg-white/[.04]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{face?.emoji ?? "🙂"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-zinc-900 dark:text-white">
                        {p.handle}
                        <span className="ml-2 text-xs font-medium text-zinc-400">
                          {p.birth_year ? `${thisYear - p.birth_year}살` : ""}
                          {p.admission_year
                            ? ` · ${String(p.admission_year).slice(2)}학번`
                            : ""}
                        </span>
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {p.mbti ?? ""}
                        {p.height_range
                          ? ` · ${formatHeight(p.height_range)}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-xl">💗</span>
                  </div>

                  {p.hobbies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.hobbies.map((h) => (
                        <span
                          key={h}
                          className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  <form action={acceptLike} className="mt-4">
                    <input type="hidden" name="liker_id" value={p.id} />
                    <button className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02]">
                      💗 수락하고 채팅 시작하기
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
