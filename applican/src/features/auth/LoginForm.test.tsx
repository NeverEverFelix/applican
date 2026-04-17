import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import LoginForm from "./LoginForm";
import type { ContinueResult } from "./useLoginFlow";
import type { UseLoginFlow } from "./useLoginFlow";

afterEach(() => {
  cleanup();
});

function createFlow(overrides: Partial<UseLoginFlow> = {}): UseLoginFlow {
  const onContinue = vi.fn<() => ContinueResult>(() => ({ status: "invalid_email" }));

  return {
    step: "email",
    email: "",
    password: "",
    isEmailValid: false,
    isEmailInvalid: false,
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onContinue,
    goToEmailStep: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderLoginForm(flow: UseLoginFlow, props: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  return render(
    <MemoryRouter>
      <LoginForm
        flow={flow}
        logoSrc="/logo.svg"
        googleIconSrc="/google.svg"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("LoginForm", () => {
  it("continues from the email step when the form is submitted", () => {
    const flow = createFlow({
      email: "user@example.com",
      isEmailValid: true,
      onContinue: vi.fn<() => ContinueResult>(() => ({
        status: "advanced_to_password",
        normalizedEmail: "user@example.com",
      })),
    });

    renderLoginForm(flow);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(flow.onContinue).toHaveBeenCalledTimes(1);
  });

  it("submits the normalized email and password on the password step", () => {
    const flow = createFlow({
      step: "password",
      email: "user@example.com",
      password: "secret",
    });
    const onPasswordSubmit = vi.fn();

    renderLoginForm(flow, { onPasswordSubmit });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onPasswordSubmit).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
    });
    expect(screen.getByRole("button", { name: "Change email" })).toBeTruthy();
  });

  it("fires Google sign-in from the email step", () => {
    const flow = createFlow();
    const onGoogleSignIn = vi.fn();

    renderLoginForm(flow, { onGoogleSignIn });
    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));

    expect(onGoogleSignIn).toHaveBeenCalledTimes(1);
  });
});
