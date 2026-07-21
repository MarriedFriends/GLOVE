"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  GENDER_OPTIONS,
  MIN_ADMISSION_YEAR,
  MAX_ADMISSION_YEAR,
  MIN_AGE,
  MAX_AGE,
  HEIGHT_BUCKETS,
  FACE_OPTIONS,
  HOBBY_OPTIONS,
  MAX_HOBBIES,
} from "@/lib/onboarding-options";
import type { FaceType, Gender } from "@/lib/supabase/database.types";

function fail(message: string): never {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
}

export async function saveOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gender = String(formData.get("gender") ?? "");
  const admissionYear = Number(formData.get("admission_year"));
  const age = Number(formData.get("age"));
  const heightRange = String(formData.get("height_range") ?? "");
  const faceType = String(formData.get("face_type") ?? "");
  const mbti = String(formData.get("mbti") ?? "");
  const hobbies = formData.getAll("hobbies").map(String);

  // Validate every answer against the shared option lists.
  if (!GENDER_OPTIONS.some((o) => o.value === gender)) {
    fail("성별을 선택해주세요.");
  }
  if (
    !Number.isInteger(admissionYear) ||
    admissionYear < MIN_ADMISSION_YEAR ||
    admissionYear > MAX_ADMISSION_YEAR
  ) {
    fail("학번을 선택해주세요.");
  }
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    fail("나이를 선택해주세요.");
  }
  if (!HEIGHT_BUCKETS.includes(heightRange as (typeof HEIGHT_BUCKETS)[number])) {
    fail("키를 선택해주세요.");
  }
  if (!FACE_OPTIONS.some((o) => o.value === faceType)) {
    fail("얼굴상을 선택해주세요.");
  }
  if (!/^[IE][NS][TF][PJ]$/.test(mbti)) {
    fail("MBTI 네 글자를 모두 선택해주세요.");
  }
  if (
    hobbies.length < 1 ||
    hobbies.length > MAX_HOBBIES ||
    !hobbies.every((h) =>
      HOBBY_OPTIONS.includes(h as (typeof HOBBY_OPTIONS)[number]),
    )
  ) {
    fail(`취미를 1~${MAX_HOBBIES}개 골라주세요.`);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      gender: gender as Gender,
      admission_year: admissionYear,
      birth_year: new Date().getFullYear() - age,
      height_range: heightRange,
      face_type: faceType as FaceType,
      mbti,
      hobbies,
    })
    .eq("id", user.id);

  if (error) fail(error.message);

  revalidatePath("/", "layout");
  redirect("/");
}
