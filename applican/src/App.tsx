import * as Sentry from "@sentry/react";
import { PostHogProvider } from "@posthog/react";
import { StrictMode } from "react";
import AppRouter from "./router";
import { AuthSessionProvider } from "./features/auth/AuthSessionProvider";
import { posthogClient } from "./posthog";

export default function App() {
  const app = (
    <StrictMode>
      <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
        <AuthSessionProvider>
          <AppRouter />
        </AuthSessionProvider>
      </Sentry.ErrorBoundary>
    </StrictMode>
  );

  if (posthogClient) {
    return <PostHogProvider client={posthogClient}>{app}</PostHogProvider>;
  }

  return app;
}
