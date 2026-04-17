import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";

import { isEmailVerifiedSession } from "./emailVerification";

function createSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    expires_at: 9999999999,
    token_type: "bearer",
    user: {
      id: "user-id",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-04-16T00:00:00.000Z",
      ...overrides,
    },
  } as Session;
}

describe("isEmailVerifiedSession", () => {
  it("returns false when there is no session", () => {
    expect(isEmailVerifiedSession(null)).toBe(false);
  });

  it("returns true for non-email auth providers", () => {
    const session = createSession({
      app_metadata: { provider: "google" },
      email_confirmed_at: null,
    });

    expect(isEmailVerifiedSession(session)).toBe(true);
  });

  it("returns true for email users with a confirmed email timestamp", () => {
    const session = createSession({
      app_metadata: { provider: "email" },
      email_confirmed_at: "2026-04-16T12:00:00.000Z",
    });

    expect(isEmailVerifiedSession(session)).toBe(true);
  });

  it("returns false for email users without confirmation", () => {
    const session = createSession({
      app_metadata: { provider: "email" },
      email_confirmed_at: null,
    });

    expect(isEmailVerifiedSession(session)).toBe(false);
  });
});
