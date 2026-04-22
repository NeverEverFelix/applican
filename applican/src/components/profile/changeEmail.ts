import { useEffect, useState } from "react";
import { getAuthErrorMessage } from "../../features/auth/auth";
import { normalizeEmail, validateEmail } from "../../features/auth/validateEmail";
import { supabase } from "../../lib/supabaseClient";

async function requestEmailChange(nextEmail: string) {
  const normalizedEmail = normalizeEmail(nextEmail);
  const { error } = await supabase.auth.updateUser({
    email: normalizedEmail,
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return normalizedEmail;
}

export function useChangeEmail(currentEmail: string) {
  const [emailDraft, setEmailDraft] = useState(currentEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setEmailDraft(currentEmail);
  }, [currentEmail]);

  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const emailValidation = validateEmail(emailDraft);
  const normalizedDraft = emailValidation.value;
  const hasChanged = normalizedDraft !== normalizedCurrentEmail;
  const isInvalid = hasChanged && !emailValidation.isValid;
  const canSubmit = emailValidation.isValid && hasChanged && !isSubmitting;

  const submitChange = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const nextEmail = await requestEmailChange(normalizedDraft);
      setStatusMessage(`Check ${nextEmail} to confirm the address change.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to change email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    emailDraft,
    setEmailDraft,
    submitChange,
    isSubmitting,
    canSubmit,
    isInvalid,
    statusMessage,
    errorMessage,
  };
}
