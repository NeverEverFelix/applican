import { useState } from "react";
import { validateEmail } from "./validateEmail";

export type LoginStep = "email" | "password";

export type ContinueResult =
  | "advanced_to_password"
  | "invalid_email"
  | "already_in_password_step";

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

  const onEmailChange = (value: string) => {
    setEmail(value);
    const validation = validateEmail(value);
    setIsEmailValid(validation.isValid);
    setIsEmailInvalid(!validation.isValid && value.trim().length > 0);
  };

  const onPasswordChange = (value: string) => {
    setPassword(value);
  };

  const onContinue = (): ContinueResult => {
    if (step === "password") {
      return "already_in_password_step";
    }

    const validation = validateEmail(email);
    setIsEmailValid(validation.isValid);
    setIsEmailInvalid(!validation.isValid);

    if (!validation.isValid) {
      return "invalid_email";
    }

    setEmail(validation.value);
    setStep("password");
    return "advanced_to_password";
  };

  const goToEmailStep = () => {
    setStep("email");
  };

  const reset = () => {
    setStep("email");
    setEmail("");
    setPassword("");
    setIsEmailValid(false);
    setIsEmailInvalid(false);
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
