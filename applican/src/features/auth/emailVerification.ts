import type { Session } from "@supabase/supabase-js";

export function isEmailVerifiedSession(session: Session | null) {
  if (!session) {
    return false;
  }

  const provider = session.user.app_metadata?.provider;
  if (typeof provider === "string" && provider !== "email") {
    return true;
  }

  return Boolean(session.user.email_confirmed_at);
}
