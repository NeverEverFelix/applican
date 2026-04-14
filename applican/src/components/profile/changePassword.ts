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
  const canSubmit = Boolean(normalizeEmail(email)) && !isSubmitting;

  const submitChange = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordChange(email);
      window.alert("Check your email for the password reset link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitChange,
    isSubmitting,
    canSubmit,
  };
}
