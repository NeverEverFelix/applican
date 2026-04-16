import { useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import LoginScreenTransition, { type LoginScreenTransitionHandle } from "./MorphTransition";
import { LoginTransitionContext } from "./loginTransitionContext";

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
