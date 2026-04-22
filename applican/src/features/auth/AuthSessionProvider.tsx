import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../../lib/supabaseClient";
import { AuthSessionStore, type AuthSessionContextValue } from "./authSessionStore";

type AuthSessionProviderProps = {
  children: ReactNode;
};

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [session, setSession] = useState<AuthSessionContextValue["session"]>(null);
  const [isChecking, setIsChecking] = useState(true);

  const refreshSession = async () => {
    await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
  };

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
  }, [setSession]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      session,
      isChecking,
      isAuthenticated: Boolean(session),
      refreshSession,
    }),
    [isChecking, session],
  );

  return <AuthSessionStore.Provider value={value}>{children}</AuthSessionStore.Provider>;
}
