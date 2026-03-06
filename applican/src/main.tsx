import "./sentry.ts";
import * as Sentry from "@sentry/react";
import { PostHogProvider } from "@posthog/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AppRouter from "./router.tsx";
import { AuthSessionProvider } from "./features/auth/AuthSessionContext.tsx";
import { posthogClient } from "./posthog";

const app = (
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <AuthSessionProvider>
        <AppRouter />
      </AuthSessionProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(
  posthogClient ? (
    <PostHogProvider client={posthogClient}>
      {app}
    </PostHogProvider>
  ) : (
    app
  ),
);
