import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSignupFlow } from "./useSignupFlow";

describe("useSignupFlow", () => {
  it("rejects incomplete details and marks the missing fields invalid", () => {
    const { result } = renderHook(() => useSignupFlow());

    act(() => {
      result.current.onEmailChange("person@example.com");
      result.current.onNameChange("");
      result.current.onJobRoleChange("");
    });

    let continueResult:
      | ReturnType<typeof result.current.onContinue>
      | undefined;

    act(() => {
      continueResult = result.current.onContinue();
    });

    expect(continueResult).toEqual({ status: "invalid_details" });
    expect(result.current.step).toBe("details");
    expect(result.current.isEmailValid).toBe(true);
    expect(result.current.isNameInvalid).toBe(true);
    expect(result.current.isJobRoleInvalid).toBe(true);
  });

  it("normalizes valid details and advances to the password step", () => {
    const { result } = renderHook(() => useSignupFlow());

    act(() => {
      result.current.onEmailChange("  USER@Example.COM ");
      result.current.onNameChange(" Ada Lovelace ");
      result.current.onJobRoleChange(" Founding Engineer ");
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
    expect(result.current.isNameComplete).toBe(true);
    expect(result.current.isJobRoleComplete).toBe(true);
  });

  it("resets all collected state", () => {
    const { result } = renderHook(() => useSignupFlow());

    act(() => {
      result.current.onEmailChange("user@example.com");
      result.current.onNameChange("Ada Lovelace");
      result.current.onJobRoleChange("Engineer");
      result.current.onContinue();
      result.current.onPasswordChange("secret");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe("details");
    expect(result.current.email).toBe("");
    expect(result.current.name).toBe("");
    expect(result.current.jobRole).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.isEmailValid).toBe(false);
    expect(result.current.isNameComplete).toBe(false);
    expect(result.current.isJobRoleComplete).toBe(false);
  });
});
