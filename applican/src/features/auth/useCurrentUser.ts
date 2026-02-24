import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

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
  const [name, setName] = useState("User");

  useEffect(() => {
    let active = true;

    const syncUser = (user: User | null) => {
      if (!active) {
        return;
      }
      setName(getDisplayName(user));
    };

    supabase.auth.getUser().then(({ data }) => {
      syncUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return name;
}
