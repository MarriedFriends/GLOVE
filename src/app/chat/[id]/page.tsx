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
    .select("id, user_low, user_high, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!match || match.status !== "active") redirect("/matches");

  const otherId = match.user_low === user.id ? match.user_high : match.user_low;
  const [otherRes, messagesRes, questionsRes, roundsRes, contactsRes] =
    await Promise.all([
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
    supabase.from("questions").select("*").order("stage").order("ord"),
    supabase
      .from("question_rounds")
      .select("*")
      .eq("match_id", match.id)
      .order("round_no", { ascending: true }),
    supabase.from("contact_reveals").select("*").eq("match_id", match.id),
  ]);
  const other = otherRes.data;
  const messages = messagesRes.data;
  const questions = questionsRes.data ?? [];
  const rounds = roundsRes.data ?? [];
  const contacts = contactsRes.data ?? [];

  // Answers visible to me right now (mine + those in revealed rounds).
  const { data: answers } = rounds.length
    ? await supabase
        .from("question_answers")
        .select("*")
        .in(
          "round_id",
          rounds.map((r) => r.id),
        )
    : { data: [] };

  const emoji =
    FACE_OPTIONS.find((o) => o.value === other?.face_type)?.emoji ?? "🙂";

  return (
    <div className="flex h-dvh flex-col bg-gradient-to-b from-rose-50 via-white to-white font-sans dark:from-rose-950/30 dark:via-black dark:to-black">
      <ChatRoom
        matchId={match.id}
        myId={user.id}
        userLow={match.user_low}
        other={{ handle: other?.handle ?? "알 수 없음", emoji }}
        matchCreatedAt={match.created_at}
        initialContacts={contacts}
        initialMessages={messages ?? []}
        questions={questions}
        initialRounds={rounds}
        initialAnswers={answers ?? []}
      />
    </div>
  );
}
