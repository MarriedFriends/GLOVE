"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Records a like or a pass on a candidate. On a mutual like the DB trigger
 * creates the match row; we detect that here to show the celebration banner.
 */
export async function sendLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const likeeId = String(formData.get("likee_id") ?? "");
  const isLike = formData.get("is_like") === "true";
  if (!likeeId) redirect("/discover");

  // ignoreDuplicates: pressing the button twice must not error.
  const { error } = await supabase.from("likes").upsert(
    { liker_id: user.id, likee_id: likeeId, is_like: isLike },
    { onConflict: "liker_id,likee_id", ignoreDuplicates: true },
  );
  if (error) {
    redirect(`/discover?error=${encodeURIComponent(error.message)}`);
  }

  if (isLike) {
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
  }

  revalidatePath("/discover");
  redirect("/discover");
}
