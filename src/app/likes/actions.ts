"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Accept an incoming like: like them back. The match itself is created at
 * the next 12:00 noon announcement, not instantly.
 */
export async function acceptLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const likerId = String(formData.get("liker_id") ?? "");
  if (!likerId) redirect("/likes");

  // One chat at a time: can't accept while my current 48h chat is running.
  const { data: myMatches } = await supabase
    .from("matches")
    .select("created_at")
    .eq("status", "active");
  const busy = (myMatches ?? []).some(
    (m) => Date.now() - +new Date(m.created_at) < 48 * 3600 * 1000,
  );
  if (busy) {
    redirect(
      `/likes?error=${encodeURIComponent(
        "지금 진행 중인 채팅이 있어요. 48시간 채팅이 끝난 뒤에 수락할 수 있어요.",
      )}`,
    );
  }

  // Verify they really liked me (visible via the "Read likes received" policy).
  const { data: theirLike } = await supabase
    .from("likes")
    .select("liker_id")
    .eq("liker_id", likerId)
    .eq("likee_id", user.id)
    .eq("is_like", true)
    .maybeSingle();
  if (!theirLike) redirect("/likes");

  const { error } = await supabase.from("likes").upsert(
    { liker_id: user.id, likee_id: likerId, is_like: true },
    { onConflict: "liker_id,likee_id", ignoreDuplicates: true },
  );
  if (error) redirect(`/likes?error=${encodeURIComponent(error.message)}`);

  // The mutual like is recorded — the result is announced at 12:00 noon,
  // when process_pending_matches() turns it into a match.
  revalidatePath("/", "layout");
  redirect("/likes?accepted=1");
}
