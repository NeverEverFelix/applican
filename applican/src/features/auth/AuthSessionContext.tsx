import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

type AuthSessionContextValue = {
  session: Session | null;
  isChecking: boolean;
  isAuthenticated: boolean;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

type AuthSessionProviderProps = {
  children: ReactNode;
};

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      setSession(data.session ?? null);
      setIsChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession ?? null);
      setIsChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      session,
      isChecking,
      isAuthenticated: Boolean(session),
    }),
    [isChecking, session],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within an AuthSessionProvider");
  }
  return context;
}
