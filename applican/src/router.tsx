// src/router.tsx
import * as Sentry from "@sentry/react";
import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
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

const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SIgnupPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function AppLayout() {
  return <Outlet />;
}

function withSuspense(page: ReactNode) {
  return <Suspense fallback={<AuthLoadingScreen />}>{page}</Suspense>;
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
        {withSuspense(<LoginPage />)}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/signup",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(<SignupPage />)}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/verify-email",
    element: (
      <RequireAuth requireVerifiedEmail={false}>
        {withSuspense(<VerifyEmailPage />)}
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
      { index: true, element: withSuspense(<HomePage />) },
      // future: { path: "ask", element: <AskPage /> },
    ],
  },

  // Catch-all
  { path: "*", element: withSuspense(<NotFoundPage />) },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
