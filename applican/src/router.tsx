// src/router.tsx
import * as Sentry from "@sentry/react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import RequireAuth from "./features/auth/RequireAuth";
import AuthLoadingScreen from "./features/auth/AuthLoadingScreen";
import RedirectIfAuthenticated from "./features/auth/RedirectIfAuthenticated";
import { useAuthGate } from "./features/auth/useAuthGate";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SIgnupPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

function AppLayout() {
  return <Outlet />;
}

function RootRedirect() {
  const { isAuthenticated, showLoading } = useAuthGate();

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  return <Navigate to={isAuthenticated ? "/app" : "/login"} replace />;
}

const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV7(createBrowserRouter);

const router = sentryCreateBrowserRouter([
  // Default entry: route by current auth session
  { path: "/", element: <RootRedirect /> },

  // Public
  {
    path: "/login",
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/signup",
    element: (
      <RedirectIfAuthenticated>
        <SignupPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/verify-email",
    element: (
      <RequireAuth requireVerifiedEmail={false}>
        <VerifyEmailPage />
      </RequireAuth>
    ),
  },

  // Protected app shell
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      // future: { path: "ask", element: <AskPage /> },
    ],
  },

  // Catch-all
  { path: "*", element: <NotFoundPage /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
