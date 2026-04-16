import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";

export type AuthSessionContextValue = {
  session: Session | null;
  isChecking: boolean;
  isAuthenticated: boolean;
};

export const AuthSessionStore = createContext<AuthSessionContextValue | undefined>(undefined);
