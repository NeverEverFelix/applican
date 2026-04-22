import { useState } from "react";
import { getAuthErrorMessage } from "../../features/auth/auth";
import { normalizeEmail } from "../../features/auth/validateEmail";
import { supabase } from "../../lib/supabaseClient";

const passwordResetRedirectUrl = `${window.location.origin}/change-password`;

async function requestPasswordChange(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: passwordResetRedirectUrl,
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export function useChangePassword(email: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const canSubmit = Boolean(normalizeEmail(email)) && !isSubmitting;

  const submitChange = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      await requestPasswordChange(email);
      setStatusMessage("Check your email for the password reset link.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to request password reset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitChange,
    isSubmitting,
    canSubmit,
    statusMessage,
    errorMessage,
  };
}
