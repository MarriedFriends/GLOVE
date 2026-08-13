/**
 * Glove is for verified university students only, so sign-up is limited to
 * school email domains. The same rule is enforced again inside the database
 * (`handle_new_user` trigger in supabase/schema.sql), so calling the Supabase
 * auth API directly doesn't bypass it.
 */
const STUDENT_DOMAIN_RE = /\.(ac\.kr|edu)$/;

// Team test accounts: plus-addressed mails all land in the shared dev inbox,
// and email confirmation is ON — only the inbox owner can activate them.
const TEST_ACCOUNT_RE = /^glove309e\+[^@]+@gmail\.com$/;

export function isStudentEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  return STUDENT_DOMAIN_RE.test(domain) || TEST_ACCOUNT_RE.test(email);
}
