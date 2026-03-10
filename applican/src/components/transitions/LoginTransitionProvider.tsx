import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import LoginScreenTransition, { type LoginScreenTransitionHandle } from "./MorphTransition";

type LoginTransitionContextValue = {
  runLoginTransition: (callbacks?: { onCovered?: () => void; onComplete?: () => void }) => void;
};

const LoginTransitionContext = createContext<LoginTransitionContextValue | null>(null);

export function LoginTransitionProvider({ children }: { children: ReactNode }) {
  const transitionRef = useRef<LoginScreenTransitionHandle | null>(null);

  const runLoginTransition = useCallback(
    (callbacks?: { onCovered?: () => void; onComplete?: () => void }) => {
      transitionRef.current?.run(callbacks);
    },
    []
  );

  const value = useMemo(
    () => ({
      runLoginTransition,
    }),
    [runLoginTransition]
  );

  return (
    <LoginTransitionContext.Provider value={value}>
      {children}
      <LoginScreenTransition ref={transitionRef} />
    </LoginTransitionContext.Provider>
  );
}

export function useLoginTransition() {
  const context = useContext(LoginTransitionContext);

  if (!context) {
    throw new Error("useLoginTransition must be used within a LoginTransitionProvider");
  }

  return context;
}
