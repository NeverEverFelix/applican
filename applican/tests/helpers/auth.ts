import type { Page } from "@playwright/test";

const AUTH_STORAGE_KEY = "applican-auth";

type MockAuthOptions = {
  email?: string;
  fullName?: string;
  plan?: "free" | "pro";
  provider?: string;
};

export function createMockSession({
  email = "playwright-user@example.com",
  fullName = "Playwright User",
  plan = "free",
  provider = "email",
}: MockAuthOptions = {}) {
  const now = new Date();
  const expiresAt = Math.floor(now.getTime() / 1000) + 60 * 60;

  return {
    access_token: "playwright-access-token",
    refresh_token: "playwright-refresh-token",
    expires_in: 60 * 60,
    expires_at: expiresAt,
    token_type: "bearer",
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: now.toISOString(),
      phone: "",
      confirmed_at: now.toISOString(),
      last_sign_in_at: now.toISOString(),
      app_metadata: {
        provider,
        providers: [provider],
        plan,
      },
      user_metadata: {
        full_name: fullName,
      },
      identities: [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      is_anonymous: false,
    },
  };
}

export async function seedAuthenticatedSession(page: Page, options?: MockAuthOptions) {
  const session = createMockSession(options);

  await page.addInitScript(
    ({ storageKey, serializedSession }) => {
      window.localStorage.setItem(storageKey, serializedSession);
    },
    {
      storageKey: AUTH_STORAGE_KEY,
      serializedSession: JSON.stringify(session),
    },
  );

  return session;
}
