import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import AuthLoadingScreen from "./AuthLoadingScreen";
import { useAuthGate } from "./useAuthGate";

type Props = {
  children: ReactNode;
  requireVerifiedEmail?: boolean;
};

export default function RequireAuth({ children, requireVerifiedEmail = true }: Props) {
  const { isAuthenticated, isEmailVerified, showLoading } = useAuthGate();

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireVerifiedEmail && !isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
}
