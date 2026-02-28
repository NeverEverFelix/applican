import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import AuthLoadingScreen from "./AuthLoadingScreen";
import { useAuthGate } from "./useAuthGate";

type Props = { children: ReactNode };

export default function RedirectIfAuthenticated({ children }: Props) {
  const { isAuthenticated, showLoading } = useAuthGate();

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
