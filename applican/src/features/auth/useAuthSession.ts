import { useContext } from "react";
import { AuthSessionStore } from "./authSessionStore";

export function useAuthSession() {
  const context = useContext(AuthSessionStore);
  if (!context) {
    throw new Error("useAuthSession must be used within an AuthSessionProvider");
  }
  return context;
}
