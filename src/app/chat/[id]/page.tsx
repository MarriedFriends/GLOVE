import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { FACE_OPTIONS } from "@/lib/onboarding-options";
import { ChatRoom } from "./ChatRoom";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS returns the match only if I'm a participant.
  const { data: match } = await supabase
    .from("matches")
    .select("id, user_low, user_high, status")
    .eq("id", id)
    .maybeSingle();
  if (!match || match.status !== "active") redirect("/matches");

  const otherId = match.user_low === user.id ? match.user_high : match.user_low;
  const [otherRes, messagesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("handle, face_type")
      .eq("id", otherId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("*")
      .eq("match_id", match.id)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  const other = otherRes.data;
  const messages = messagesRes.data;

  const emoji =
    FACE_OPTIONS.find((o) => o.value === other?.face_type)?.emoji ?? "🙂";

  return (
    <div className="flex h-dvh flex-col bg-gradient-to-b from-rose-50 via-white to-white font-sans dark:from-rose-950/30 dark:via-black dark:to-black">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-black/[.06] bg-white/70 px-5 py-3 backdrop-blur dark:border-white/[.08] dark:bg-black/40">
        <Link
          href="/matches"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
        >
          ←
        </Link>
        <span className="text-2xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-900 dark:text-white">
            {other?.handle ?? "알 수 없음"}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            익명 채팅 — 서로 원할 때만 정체를 공개하세요
          </p>
        </div>
      </div>

      <ChatRoom
        matchId={match.id}
        myId={user.id}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
