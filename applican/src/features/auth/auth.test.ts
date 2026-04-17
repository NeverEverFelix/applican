import { afterEach, describe, expect, it, vi } from "vitest";

const {
  signInWithPasswordMock,
  signUpMock,
  updateUserMock,
  signInWithOAuthMock,
} = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  updateUserMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      updateUser: updateUserMock,
      signInWithOAuth: signInWithOAuthMock,
    },
  },
}));

import {
  getAuthErrorMessage,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "./auth";

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth", () => {
  it("normalizes email before password sign-in", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: null });

    await signInWithPassword({
      email: "  USER@Example.COM ",
      password: "secret",
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
    });
  });

  it("normalizes signup fields and includes redirect metadata", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await signUpWithPassword({
      email: "  USER@Example.COM ",
      name: " Ada Lovelace ",
      jobRole: " Founding Engineer ",
      password: "secret",
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: "Ada Lovelace",
          job_role: "Founding Engineer",
        },
      },
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("updates user metadata after signup when a session is returned", async () => {
    const signUpResult = {
      data: { session: { access_token: "token" } },
      error: null,
    };
    signUpMock.mockResolvedValue(signUpResult);
    updateUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const result = await signUpWithPassword({
      email: "user@example.com",
      name: "Ada Lovelace",
      jobRole: "Engineer",
      password: "secret",
    });

    expect(updateUserMock).toHaveBeenCalledWith({
      data: {
        full_name: "Ada Lovelace",
        job_role: "Engineer",
      },
    });
    expect(result).toEqual(signUpResult);
  });

  it("returns the update error when metadata persistence fails", async () => {
    const signUpResult = {
      data: { session: { access_token: "token" } },
      error: null,
    };
    const updateError = { message: "metadata failed" };
    signUpMock.mockResolvedValue(signUpResult);
    updateUserMock.mockResolvedValue({ data: { user: null }, error: updateError });

    const result = await signUpWithPassword({
      email: "user@example.com",
      name: "Ada Lovelace",
      jobRole: "Engineer",
      password: "secret",
    });

    expect(result).toEqual({
      ...signUpResult,
      error: updateError,
    });
  });

  it("starts Google auth with the expected redirect", async () => {
    signInWithOAuthMock.mockResolvedValue({ data: {}, error: null });

    await signInWithGoogle();

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    });
  });

  it("maps auth errors into user-facing messages", () => {
    expect(getAuthErrorMessage(null)).toBe("");
    expect(getAuthErrorMessage(new TypeError("Failed to fetch"))).toContain(
      "Network error reaching Supabase",
    );
    expect(getAuthErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Invalid login credentials",
    );
    expect(getAuthErrorMessage({})).toBe("Authentication failed. Please try again.");
  });
});
