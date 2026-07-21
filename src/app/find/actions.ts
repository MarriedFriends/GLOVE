"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  MIN_ADMISSION_YEAR,
  MAX_ADMISSION_YEAR,
  MIN_AGE,
  MAX_AGE,
  HEIGHT_BUCKETS,
  FACE_OPTIONS,
  HOBBY_OPTIONS,
} from "@/lib/onboarding-options";

function fail(message: string): never {
  redirect(`/find?error=${encodeURIComponent(message)}`);
}

export async function savePreferences(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const minAge = Number(formData.get("min_age"));
  const maxAge = Number(formData.get("max_age"));
  const minAdmission = Number(formData.get("min_admission_year"));
  const maxAdmission = Number(formData.get("max_admission_year"));
  const sameUniversity = formData.get("same_university") === "true";
  const minHeightIdx = Number(formData.get("min_height_idx"));
  const maxHeightIdx = Number(formData.get("max_height_idx"));
  const faceTypes = formData.getAll("face_types").map(String);
  const hobby = String(formData.get("hobby") ?? "");
  const intro = String(formData.get("intro") ?? "").trim();

  const validRange = (lo: number, hi: number, min: number, max: number) =>
    Number.isInteger(lo) &&
    Number.isInteger(hi) &&
    lo >= min &&
    hi <= max &&
    lo <= hi;

  if (!validRange(minAge, maxAge, MIN_AGE, MAX_AGE)) {
    fail("나이 범위를 다시 설정해주세요.");
  }
  if (
    !validRange(minAdmission, maxAdmission, MIN_ADMISSION_YEAR, MAX_ADMISSION_YEAR)
  ) {
    fail("학번 범위를 다시 설정해주세요.");
  }
  if (!validRange(minHeightIdx, maxHeightIdx, 0, HEIGHT_BUCKETS.length - 1)) {
    fail("키 범위를 다시 설정해주세요.");
  }
  if (
    faceTypes.length < 1 ||
    !faceTypes.every((f) => FACE_OPTIONS.some((o) => o.value === f))
  ) {
    fail("원하는 얼굴상을 하나 이상 골라주세요.");
  }
  if (!HOBBY_OPTIONS.includes(hobby as (typeof HOBBY_OPTIONS)[number])) {
    fail("함께하고 싶은 취미를 골라주세요.");
  }
  if (intro.length < 10 || intro.length > 80) {
    fail("자기소개는 10~80자로 적어주세요.");
  }

  const { error } = await supabase.from("match_preferences").upsert({
    user_id: user.id,
    mode: "date",
    min_age: minAge,
    max_age: maxAge,
    min_admission_year: minAdmission,
    max_admission_year: maxAdmission,
    same_university: sameUniversity,
    min_height_idx: minHeightIdx,
    max_height_idx: maxHeightIdx,
    face_types: faceTypes,
    hobby,
    intro,
    updated_at: new Date().toISOString(),
  });

  if (error) fail(error.message);

  revalidatePath("/", "layout");
  redirect("/discover");
}
