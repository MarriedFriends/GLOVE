import { createClient } from "@/lib/supabase/server";

/**
 * Fetches the logged-in user's profile row (or null if not signed in).
 * RLS lets a user read their own row.
 */
export async function getMyProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

/** The survey fields that must be answered before a profile is "onboarded". */
export const SURVEY_FIELDS =
  "gender, admission_year, height_range, face_type, mbti" as const;

/**
 * A profile counts as "onboarded" once every survey question is answered.
 * Used to decide whether to send the user through the wizard.
 */
export function isProfileComplete(
  profile: {
    gender: string | null;
    admission_year: number | null;
    height_range: string | null;
    face_type: string | null;
    mbti: string | null;
  } | null,
): boolean {
  return Boolean(
    profile?.gender &&
      profile?.admission_year &&
      profile?.height_range &&
      profile?.face_type &&
      profile?.mbti,
  );
}
