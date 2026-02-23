import { useState } from "react";
import { validateEmail } from "./validateEmail";

export type LoginStep = "email" | "password";

export type ContinueResult =
  | { status: "advanced_to_password"; normalizedEmail: string }
  | { status: "invalid_email" }
  | { status: "already_in_password_step" };

export type UseLoginFlow = {
  step: LoginStep;
  email: string;
  password: string;
  isEmailValid: boolean;
  isEmailInvalid: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onContinue: () => ContinueResult;
  goToEmailStep: () => void;
  reset: () => void; 
};

export function useLoginFlow(): UseLoginFlow {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isEmailInvalid, setIsEmailInvalid] = useState(false);
  const [emailAttempted, setEmailAttempted] = useState(false);

  const onEmailChange = (value: string) => {
    setEmail(value);
    const validation = validateEmail(value);
    setIsEmailValid(validation.isValid);
    setIsEmailInvalid(
      !validation.isValid && (value.trim().length > 0 || emailAttempted),
    );
  };

  const onPasswordChange = (value: string) => {
    setPassword(value);
  };

  const onContinue = (): ContinueResult => {
    if (step === "password") {
      return { status: "already_in_password_step" };
    }

    setEmailAttempted(true);
    const validation = validateEmail(email);
    setIsEmailValid(validation.isValid);
    setIsEmailInvalid(!validation.isValid);

    if (!validation.isValid) {
      return { status: "invalid_email" };
    }

    setEmail(validation.value);
    setStep("password");
    return { status: "advanced_to_password", normalizedEmail: validation.value };
  };

  const goToEmailStep = () => {
    setStep("email");
    setPassword("");
  };

  const reset = () => {
    setStep("email");
    setEmail("");
    setPassword("");
    setIsEmailValid(false);
    setIsEmailInvalid(false);
    setEmailAttempted(false);
  };

  return {
    step,
    email,
    password,
    isEmailValid,
    isEmailInvalid,
    onEmailChange,
    onPasswordChange,
    onContinue,
    goToEmailStep,
    reset,
  };
}
