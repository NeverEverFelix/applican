// src/auth/RequireAuth.tsx
import React from "react";

type Props = { children: React.ReactNode };

export default function RequireAuth({ children }: Props) {
  return <>{children}</>;
}