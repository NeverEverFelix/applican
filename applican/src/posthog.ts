import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const isDev = import.meta.env.DEV;

let initialized = false;
const PROBE_KEY = "applican:posthog:probe-sent:v1";

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    loaded: (client) => {
      // Emit one custom event per browser to verify custom events ingest correctly.
      if (!window.localStorage.getItem(PROBE_KEY)) {
        client.capture("custom_event_probe", { source: "client_init" });
        window.localStorage.setItem(PROBE_KEY, "1");
      }

      if (isDev) {
        client.debug();
        console.info("[posthog] initialized");
      }
    },
  });
  initialized = true;
} else if (isDev) {
  console.warn("[posthog] VITE_PUBLIC_POSTHOG_KEY is missing; PostHog is disabled");
}

export const posthogClient = initialized ? posthog : null;

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  if (!posthogClient) {
    if (isDev) {
      console.debug(`[posthog] skipped event (disabled): ${event}`);
    }
    return;
  }

  posthogClient.capture(event, properties);
  if (isDev) {
    console.info("[posthog] capture", event, properties ?? {});
  }
}
