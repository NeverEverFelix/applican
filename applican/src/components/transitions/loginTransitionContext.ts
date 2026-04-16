import { createContext } from "react";

export type LoginTransitionContextValue = {
  runLoginTransition: (callbacks?: { onCovered?: () => void; onComplete?: () => void }) => void;
};

export const LoginTransitionContext = createContext<LoginTransitionContextValue | null>(null);
