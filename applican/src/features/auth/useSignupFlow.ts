import { useState } from "react";
import { validateEmail } from "./validateEmail";

export type SignupStep = "details" | "password";

export type ContinueResult =
  | { status: "advanced_to_password"; normalizedEmail: string }
  | { status: "invalid_details" }
  | { status: "already_in_password_step" };

export type UseSignupFlow = {
  step: SignupStep;
  email: string;
  name: string;
  jobRole: string;
  password: string;
  isEmailValid: boolean;
  isEmailInvalid: boolean;
  isNameComplete: boolean;
  isNameInvalid: boolean;
  isJobRoleComplete: boolean;
  isJobRoleInvalid: boolean;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onNameBlur: () => void;
  onJobRoleChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onContinue: () => ContinueResult;
  goToDetailsStep: () => void;
  reset: () => void;
};

export function useSignupFlow(): UseSignupFlow {
  const [step, setStep] = useState<SignupStep>("details");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isEmailInvalid, setIsEmailInvalid] = useState(false);
  const [isNameComplete, setIsNameComplete] = useState(false);
  const [isNameInvalid, setIsNameInvalid] = useState(false);
  const [isJobRoleComplete, setIsJobRoleComplete] = useState(false);
  const [isJobRoleInvalid, setIsJobRoleInvalid] = useState(false);
  const [detailsAttempted, setDetailsAttempted] = useState(false);

  const onEmailChange = (value: string) => {
    setEmail(value);
    const validation = validateEmail(value);
    setIsEmailValid(validation.isValid);
    setIsEmailInvalid(
      !validation.isValid && (value.trim().length > 0 || detailsAttempted),
    );
  };

  const onNameChange = (value: string) => {
    setName(value);
    const isValid = value.trim().length > 0;
    setIsNameComplete(isValid);
    setIsNameInvalid(!isValid && detailsAttempted);
  };

  const onNameBlur = () => {
    const isValid = name.trim().length > 0;
    setIsNameComplete(isValid);
    setIsNameInvalid(!isValid);
  };

  const onJobRoleChange = (value: string) => {
    setJobRole(value);
    const isValid = value.trim().length > 0;
    setIsJobRoleComplete(isValid);
    setIsJobRoleInvalid(!isValid && detailsAttempted);
  };

  const onPasswordChange = (value: string) => {
    setPassword(value);
  };

  const onContinue = (): ContinueResult => {
    if (step === "password") {
      return { status: "already_in_password_step" };
    }

    setDetailsAttempted(true);
    const emailValidation = validateEmail(email);
    const nameIsValid = name.trim().length > 0;
    const jobRoleIsValid = jobRole.trim().length > 0;

    setIsEmailValid(emailValidation.isValid);
    setIsEmailInvalid(!emailValidation.isValid);
    setIsNameComplete(nameIsValid);
    setIsNameInvalid(!nameIsValid);
    setIsJobRoleComplete(jobRoleIsValid);
    setIsJobRoleInvalid(!jobRoleIsValid);

    if (!emailValidation.isValid || !nameIsValid || !jobRoleIsValid) {
      return { status: "invalid_details" };
    }

    setEmail(emailValidation.value);
    setStep("password");
    return { status: "advanced_to_password", normalizedEmail: emailValidation.value };
  };

  const goToDetailsStep = () => {
    setStep("details");
    setPassword("");
  };

  const reset = () => {
    setStep("details");
    setEmail("");
    setName("");
    setJobRole("");
    setPassword("");
    setIsEmailValid(false);
    setIsEmailInvalid(false);
    setIsNameComplete(false);
    setIsNameInvalid(false);
    setIsJobRoleComplete(false);
    setIsJobRoleInvalid(false);
    setDetailsAttempted(false);
  };

  return {
    step,
    email,
    name,
    jobRole,
    password,
    isEmailValid,
    isEmailInvalid,
    isNameComplete,
    isNameInvalid,
    isJobRoleComplete,
    isJobRoleInvalid,
    onEmailChange,
    onNameChange,
    onNameBlur,
    onJobRoleChange,
    onPasswordChange,
    onContinue,
    goToDetailsStep,
    reset,
  };
}
