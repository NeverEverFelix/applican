import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SignupForm from "./SignupForm";
import type { UseSignupFlow } from "./useSignupFlow";

afterEach(() => {
  cleanup();
});

function createFlow(overrides: Partial<UseSignupFlow> = {}): UseSignupFlow {
  return {
    step: "details",
    email: "",
    name: "",
    jobRole: "",
    password: "",
    isEmailValid: false,
    isEmailInvalid: false,
    isNameComplete: false,
    isNameInvalid: false,
    isJobRoleComplete: false,
    isJobRoleInvalid: false,
    onEmailChange: vi.fn(),
    onNameChange: vi.fn(),
    onNameBlur: vi.fn(),
    onJobRoleChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onContinue: vi.fn(() => ({ status: "invalid_details" })),
    goToDetailsStep: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderSignupForm(flow: UseSignupFlow, props: Partial<React.ComponentProps<typeof SignupForm>> = {}) {
  return render(
    <SignupForm
      flow={flow}
      logoSrc="/logo.svg"
      googleIconSrc="/google.svg"
      {...props}
    />,
  );
}

describe("SignupForm", () => {
  it("continues from the details step when the required fields are valid", () => {
    const flow = createFlow({
      email: "user@example.com",
      name: "Ada Lovelace",
      jobRole: "Engineer",
      isEmailValid: true,
      onContinue: vi.fn(() => ({
        status: "advanced_to_password",
        normalizedEmail: "user@example.com",
      })),
    });

    renderSignupForm(flow);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(flow.onContinue).toHaveBeenCalledTimes(1);
  });

  it("submits the full payload from the password step", () => {
    const flow = createFlow({
      step: "password",
      email: "user@example.com",
      name: "Ada Lovelace",
      jobRole: "Engineer",
      password: "secret",
    });
    const onSubmit = vi.fn();

    renderSignupForm(flow, { onSubmit });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "user@example.com",
      name: "Ada Lovelace",
      jobRole: "Engineer",
      password: "secret",
    });
    expect(screen.getByRole("button", { name: "Change details" })).toBeTruthy();
  });

  it("fires Google sign-in from the details step", () => {
    const flow = createFlow();
    const onGoogleSignIn = vi.fn();

    renderSignupForm(flow, { onGoogleSignIn });
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(onGoogleSignIn).toHaveBeenCalledTimes(1);
  });
});
