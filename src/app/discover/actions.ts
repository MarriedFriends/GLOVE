"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Records a like on a candidate (there is no pass button — users either like
 * or leave it). On a mutual like the DB trigger creates the match row; we
 * detect that here to show the celebration banner.
 */
export async function sendLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const likeeId = String(formData.get("likee_id") ?? "");
  if (!likeeId) redirect("/discover");

  // One chat at a time: no sending likes while my 48h chat is running.
  const { data: myMatches } = await supabase
    .from("matches")
    .select("created_at")
    .eq("status", "active");
  const busy = (myMatches ?? []).some(
    (m) => Date.now() - +new Date(m.created_at) < 48 * 3600 * 1000,
  );
  if (busy) {
    redirect(
      `/discover?error=${encodeURIComponent(
        "채팅 진행 중에는 좋아요를 보낼 수 없어요. 48시간 채팅이 끝나면 다시 만나요!",
      )}`,
    );
  }

  // ignoreDuplicates: pressing the button twice must not error.
  const { error } = await supabase.from("likes").upsert(
    { liker_id: user.id, likee_id: likeeId, is_like: true },
    { onConflict: "liker_id,likee_id", ignoreDuplicates: true },
  );
  if (error) {
    redirect(`/discover?error=${encodeURIComponent(error.message)}`);
  }

  // The match trigger ran inside the insert above — check if it fired.
  const [low, high] = [user.id, likeeId].sort();
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("user_low", low)
    .eq("user_high", high)
    .eq("status", "active")
    .maybeSingle();

  if (match) {
    const { data: other } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", likeeId)
      .single();
    revalidatePath("/discover");
    redirect(`/discover?matched=${encodeURIComponent(other?.handle ?? "상대")}`);
  }

  revalidatePath("/discover");
  redirect("/discover");
}
