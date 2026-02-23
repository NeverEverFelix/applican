import { useState } from "react";
import { validateEmail } from "./validateEmail";

export type UseSignupFlow = {
  email: string;
  name: string;
  jobRole: string;
  isEmailValid: boolean;
  isEmailInvalid: boolean;
  isNameComplete: boolean;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onNameBlur: () => void;
  onJobRoleChange: (value: string) => void;
  reset: () => void;
};

export function useSignupFlow(): UseSignupFlow {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isEmailInvalid, setIsEmailInvalid] = useState(false);
  const [isNameComplete, setIsNameComplete] = useState(false);

  const onEmailChange = (value: string) => {
    setEmail(value);
    const validation = validateEmail(value);
    setIsEmailValid(validation.isValid);
    setIsEmailInvalid(!validation.isValid && value.trim().length > 0);
  };

  const onNameChange = (value: string) => {
    setName(value);
    setIsNameComplete(false);
  };

  const onNameBlur = () => {
    setIsNameComplete(name.trim().length > 0);
  };

  const onJobRoleChange = (value: string) => {
    setJobRole(value);
  };

  const reset = () => {
    setEmail("");
    setName("");
    setJobRole("");
    setIsEmailValid(false);
    setIsEmailInvalid(false);
    setIsNameComplete(false);
  };

  return {
    email,
    name,
    jobRole,
    isEmailValid,
    isEmailInvalid,
    isNameComplete,
    onEmailChange,
    onNameChange,
    onNameBlur,
    onJobRoleChange,
    reset,
  };
}
