import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Handles the link in the sign-up confirmation email. Supabase appends
 * `token_hash` and `type` to the URL; we verify them to complete the sign-up
 * and create a session.
 *
 * NOTE: This only runs if "Confirm email" is ON in Supabase. For that flow you
 * must also set the email template to send `token_hash` (see Supabase docs).
 * For early development it's simpler to turn "Confirm email" OFF.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent("링크가 만료되었거나 잘못되었어요.")}`,
      request.url,
    ),
  );
}
