import type { User } from "@supabase/supabase-js";
import { useAuthSession } from "./AuthSessionContext";

function getDisplayName(user: User | null) {
  if (!user) {
    return "User";
  }

  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  const name = user.user_metadata?.name;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  const emailPrefix = user.email?.split("@")[0]?.trim();
  if (emailPrefix) {
    return emailPrefix;
  }

  return "User";
}

export function useCurrentUserName() {
  const { session } = useAuthSession();
  return getDisplayName(session?.user ?? null);
}

export function useCurrentUserPlan() {
  const { session } = useAuthSession();
  const rawPlan = session?.user?.app_metadata?.plan;
  if (typeof rawPlan !== "string") {
    return null;
  }

  const normalizedPlan = rawPlan.trim().toLowerCase();
  if (!normalizedPlan) {
    return null;
  }

  return normalizedPlan;
}
