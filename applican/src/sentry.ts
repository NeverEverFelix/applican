import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const isDev = import.meta.env.DEV;
const release = import.meta.env.VITE_SENTRY_RELEASE ?? "applican-local";

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release,
    debug: isDev,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.captureConsoleIntegration({
        levels: isDev ? ["log", "info", "warn", "error"] : ["warn", "error"],
      }),
    ],
    tracesSampleRate: 1.0,
  });

  if (isDev) {
    console.info("[sentry] initialized");
  }
} else if (isDev) {
  console.warn("[sentry] VITE_SENTRY_DSN is missing; Sentry is disabled");
}
