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
    try {
      await requestEmailChange(normalizedDraft);
      window.alert("Check your email to confirm the address change.");
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
  };
}
