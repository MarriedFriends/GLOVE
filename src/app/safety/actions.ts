"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Safety actions: block, report, and account deletion. All of them return
 * `{ error }` instead of redirecting so the client components that call them
 * can show inline feedback (the exception is deleteAccount, which signs the
 * user out and must leave the page).
 */

const REPORT_REASONS = [
  "harassment",
  "spam",
  "inappropriate",
  "fake",
  "other",
] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function blockUser(targetId: string, matchId?: string) {
  const { supabase, user } = await requireUser();
  if (!targetId || targetId === user.id) return { error: "잘못된 요청이에요." };

  const { error } = await supabase.from("blocks").upsert(
    { blocker_id: user.id, blocked_id: targetId },
    { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
  );
  if (error) return { error: error.message };

  // Blocking from inside a chat also ends that chat.
  if (matchId) {
    await supabase
      .from("matches")
      .update({ status: "unmatched" })
      .eq("id", matchId);
  }

  revalidatePath("/", "layout");
  return {};
}

export async function reportUser(input: {
  targetId: string;
  reason: string;
  details: string;
  alsoBlock: boolean;
  matchId?: string;
}) {
  const { supabase, user } = await requireUser();
  const { targetId, alsoBlock, matchId } = input;
  if (!targetId || targetId === user.id) return { error: "잘못된 요청이에요." };
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) {
    return { error: "신고 사유를 선택해주세요." };
  }
  const reason = input.reason as ReportReason;

  const details = input.details.trim().slice(0, 1000);
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_id: targetId,
    reason,
    details: details || null,
  });
  if (error) return { error: error.message };

  if (alsoBlock) return blockUser(targetId, matchId);
  return {};
}

export async function deleteAccount() {
  const { supabase } = await requireUser();

  // security-definer RPC: deletes the auth user; profiles, likes, matches,
  // messages … all cascade away via foreign keys.
  const { error } = await supabase.rpc("delete_account");
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(
    `/login?message=${encodeURIComponent("계정이 삭제됐어요. 그동안 함께해줘서 고마워요.")}`,
  );
}
