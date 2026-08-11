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
  const mode = formData.get("mode") === "friend" ? "friend" : "date";
  const back = mode === "friend" ? "/discover?mode=friend" : "/discover";
  const backErr = (msg: string) =>
    `${back}${mode === "friend" ? "&" : "?"}error=${encodeURIComponent(msg)}`;
  if (!likeeId) redirect(back);

  // One chat per mode: no sending likes while my 48h chat (this mode) runs.
  const { data: myMatches } = await supabase
    .from("matches")
    .select("created_at")
    .eq("status", "active")
    .eq("mode", mode);
  const busy = (myMatches ?? []).some(
    (m) => Date.now() - +new Date(m.created_at) < 48 * 3600 * 1000,
  );
  if (busy) {
    redirect(
      backErr("채팅 진행 중에는 좋아요를 보낼 수 없어요. 48시간 채팅이 끝나면 다시 만나요!"),
    );
  }

  // ignoreDuplicates: pressing the button twice must not error.
  const { error } = await supabase.from("likes").upsert(
    { liker_id: user.id, likee_id: likeeId, mode, is_like: true },
    { onConflict: "liker_id,likee_id,mode", ignoreDuplicates: true },
  );
  if (error) {
    redirect(backErr(error.message));
  }

  // Results (including mutual likes) are announced at the next 12:00 noon.
  revalidatePath("/discover");
  redirect(back);
}
