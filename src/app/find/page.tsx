import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/lib/profile";
import { FindWizard } from "./FindWizard";

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Must have finished the survey before setting match preferences.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender, admission_year, height_range, face_type, mbti")
    .eq("id", user.id)
    .single();
  if (!isProfileComplete(profile)) redirect("/onboarding");

  return (
    <div className="flex flex-1 items-start justify-center bg-gradient-to-b from-rose-50 via-white to-white px-6 py-12 font-sans dark:from-rose-950/30 dark:via-black dark:to-black">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
          >
            ✕ 닫기
          </Link>
          <p className="text-sm font-medium uppercase tracking-widest text-rose-500">
            이성 찾기
          </p>
          <span className="w-10" />
        </div>
        <div className="flex justify-center">
          <FindWizard error={error} />
        </div>
      </div>
    </div>
  );
}
