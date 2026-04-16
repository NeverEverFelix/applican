import { useContext } from "react";
import { LoginTransitionContext } from "./loginTransitionContext";

export function useLoginTransition() {
  const context = useContext(LoginTransitionContext);

  if (!context) {
    throw new Error("useLoginTransition must be used within a LoginTransitionProvider");
  }

  return context;
}
