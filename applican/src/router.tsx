// src/router.tsx
import * as Sentry from "@sentry/react";
import { Suspense, lazy, useEffect } from "react";
import type { ReactNode } from "react";
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useRouteError,
  useNavigate,
} from "react-router-dom";

import RequireAuth from "./features/auth/RequireAuth";
import AuthLoadingScreen from "./features/auth/AuthLoadingScreen";
import RedirectIfAuthenticated from "./features/auth/RedirectIfAuthenticated";
import { useAuthGate } from "./features/auth/useAuthGate";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

const HomePage = lazy(() => import("./pages/HomePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function RecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const recoveryInHash = new URLSearchParams(location.hash.replace(/^#/, "")).get("type") === "recovery";
    if (!recoveryInHash || location.pathname === "/change-password") {
      return;
    }

    navigate(
      {
        pathname: "/change-password",
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, navigate]);

  return null;
}

function AppLayout() {
  return (
    <>
      <RecoveryRedirect />
      <Outlet />
    </>
  );
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

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unexpected route error";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <section>
        <h1>Something went wrong</h1>
        <p>{message}</p>
        <p>
          <Link to="/login">Return to login</Link>
        </p>
      </section>
    </main>
  );
}

const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV7(createBrowserRouter);

const router = sentryCreateBrowserRouter([
  // Default entry: route by current auth session
  { path: "/", element: <RootRedirect />, errorElement: <RouteErrorBoundary /> },

  // Public
  {
    path: "/login",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/signup",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RedirectIfAuthenticated>
        <SignupPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/verify-email",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RequireAuth requireVerifiedEmail={false}>
        <VerifyEmailPage />
      </RequireAuth>
    ),
  },
  {
    path: "/change-password",
    errorElement: <RouteErrorBoundary />,
    element: <ChangePassword />,
  },
  {
    path: "/forgot-password",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RedirectIfAuthenticated>
        <ForgotPassword />
      </RedirectIfAuthenticated>
    ),
  },

  // Protected app shell
  {
    path: "/app",
    errorElement: <RouteErrorBoundary />,
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
  { path: "*", element: withSuspense(<NotFoundPage />), errorElement: <RouteErrorBoundary /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
