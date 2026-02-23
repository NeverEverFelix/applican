// src/router.tsx
import React from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import RequireAuth from "./auth/RequireAuth";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SIgnupPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

function AppLayout() {
  return <Outlet />;
}

const router = createBrowserRouter([
  // Default entry: go to login
  { path: "/", element: <Navigate to="/login" replace /> },

  // Public
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },

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
