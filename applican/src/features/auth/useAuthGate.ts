import { useAuthSession } from "./useAuthSession";
import { isEmailVerifiedSession } from "./emailVerification";
import { useMinimumLoading } from "./useMinimumLoading";

export function useAuthGate() {
  const { isChecking, isAuthenticated, session } = useAuthSession();
  const showLoading = useMinimumLoading(isChecking);

  return {
    isAuthenticated,
    isEmailVerified: isEmailVerifiedSession(session),
    showLoading,
  };
}
