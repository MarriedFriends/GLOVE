"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isProfileComplete, SURVEY_FIELDS } from "@/lib/profile";

/**
 * Server Actions handle auth on the server, so the password never lives in
 * client-side JavaScript. Each action redirects back to the right place.
 */

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Send users who haven't finished the survey to onboarding.
  const { data: profile } = await supabase
    .from("profiles")
    .select(SURVEY_FIELDS)
    .eq("id", data.user.id)
    .single();

  revalidatePath("/", "layout");
  redirect(isProfileComplete(profile) ? "/" : "/onboarding");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    options: {
      // Where Supabase sends the user after they click the confirmation link.
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // If "Confirm email" is OFF in Supabase, signUp returns a session and the
  // user is logged in immediately. If it's ON, session is null and they must
  // click the link in their inbox first.
  if (data.session) {
    // Brand-new account → always go fill out the survey.
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  redirect(
    `/login?message=${encodeURIComponent(
      "확인 이메일을 보냈어요. 메일의 링크를 눌러 가입을 완료하세요.",
    )}`,
  );
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
