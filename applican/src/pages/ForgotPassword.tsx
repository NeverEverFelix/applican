import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import styles from "./ForgotPassword.module.css";
import pageImage from "../assets/PageImage.png";
import logo from "../assets/logo.png";
import AuthLoadingScreen from "../features/auth/AuthLoadingScreen";
import { getAuthErrorMessage } from "../features/auth/auth";
import { normalizeEmail, validateEmail } from "../features/auth/validateEmail";
import { useMinimumLoading } from "../features/auth/useMinimumLoading";
import { supabase } from "../lib/supabaseClient";

const passwordResetRedirectUrl = `${window.location.origin}/change-password`;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailAttempted, setEmailAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const emailValidation = validateEmail(email);
  const isEmailInvalid =
    !emailValidation.isValid && (emailValidation.value.length > 0 || emailAttempted);
  const inputClassName = `${styles.email} ${isEmailInvalid ? styles.emailInvalid : ""}`.trim();
  const canSubmit = emailValidation.isValid && !isSubmitting;
  const showLoading = useMinimumLoading(isSubmitting);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailAttempted(true);
    setStatusMessage("");
    setErrorMessage("");

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
        redirectTo: passwordResetRedirectUrl,
      });

      if (error) {
        setErrorMessage(getAuthErrorMessage(error));
        return;
      }

      setStatusMessage(
        "If an account exists for this email, we sent a password reset link.",
      );
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <img src={logo} alt="Logo" className={styles.logo} />
          <p className={styles.mainText}>Enter Email</p>
        </div>

        <div className={styles.main}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            className={inputClassName}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <button type="submit" className={styles.continue} disabled={!canSubmit}>
            {isSubmitting ? "Sending..." : "Continue"}
          </button>
          {statusMessage ? <p className={styles.formMessageSuccess}>{statusMessage}</p> : null}
          {errorMessage ? <p className={styles.formMessageError}>{errorMessage}</p> : null}
        </div>

        <div className={styles.passwordStepActions}>
          <Link to="/login" className={styles.secondaryLink}>
            Return to login
          </Link>
        </div>
      </form>

      <div className={styles.assetContainer}>
        <img src={pageImage} alt="Page visual" loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
