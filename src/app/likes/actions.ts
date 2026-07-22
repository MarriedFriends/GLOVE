"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Accept an incoming like: like them back, which triggers the match, then
 * jump straight into the new chat room.
 */
export async function acceptLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const likerId = String(formData.get("liker_id") ?? "");
  if (!likerId) redirect("/likes");

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

  // Mutual like → the trigger just created the match. Go straight to chat.
  const [low, high] = [user.id, likerId].sort();
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("user_low", low)
    .eq("user_high", high)
    .eq("status", "active")
    .maybeSingle();

  revalidatePath("/", "layout");
  if (match) redirect(`/chat/${match.id}`);
  redirect("/matches");
}
