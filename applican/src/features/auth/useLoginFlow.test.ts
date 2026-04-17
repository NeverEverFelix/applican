import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLoginFlow } from "./useLoginFlow";

describe("useLoginFlow", () => {
  it("stays on the email step and marks invalid email after continue", () => {
    const { result } = renderHook(() => useLoginFlow());

    act(() => {
      result.current.onEmailChange("not-an-email");
    });

    let continueResult:
      | ReturnType<typeof result.current.onContinue>
      | undefined;

    act(() => {
      continueResult = result.current.onContinue();
    });

    expect(continueResult).toEqual({ status: "invalid_email" });
    expect(result.current.step).toBe("email");
    expect(result.current.isEmailValid).toBe(false);
    expect(result.current.isEmailInvalid).toBe(true);
  });

  it("normalizes a valid email and advances to the password step", () => {
    const { result } = renderHook(() => useLoginFlow());

    act(() => {
      result.current.onEmailChange("  USER@Example.COM ");
    });

    let continueResult:
      | ReturnType<typeof result.current.onContinue>
      | undefined;

    act(() => {
      continueResult = result.current.onContinue();
    });

    expect(continueResult).toEqual({
      status: "advanced_to_password",
      normalizedEmail: "user@example.com",
    });
    expect(result.current.step).toBe("password");
    expect(result.current.email).toBe("user@example.com");
    expect(result.current.isEmailValid).toBe(true);
    expect(result.current.isEmailInvalid).toBe(false);
  });

  it("returns to the email step and clears password state", () => {
    const { result } = renderHook(() => useLoginFlow());

    act(() => {
      result.current.onEmailChange("user@example.com");
      result.current.onContinue();
      result.current.onPasswordChange("secret");
    });

    act(() => {
      result.current.goToEmailStep();
    });

    expect(result.current.step).toBe("email");
    expect(result.current.password).toBe("");
  });
});
