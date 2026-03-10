import * as Sentry from "@sentry/react";
import styles from "./LoginPage.module.css";
import pageImage from "../assets/PageImage.png";
import logo from "../assets/logo.png";
import googleIcon from "../assets/GoogleIcon.png";
import LoginForm from "../features/auth/LoginForm";
import { useLoginFlow } from "../features/auth/useLoginFlow";
import { getAuthErrorMessage, signInWithGoogle, signInWithPassword } from "../features/auth/auth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLoadingScreen from "../features/auth/AuthLoadingScreen";
import { ensureMinimumLoadingDuration, useMinimumLoading } from "../features/auth/useMinimumLoading";
import { captureEvent } from "../posthog";

export default function LoginPage() {
  const flow = useLoginFlow();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showLoading = useMinimumLoading(isSubmitting);

  const handlePasswordSubmit = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const startedAt = Date.now();
    setAuthError("");
    setIsSubmitting(true);
    try {
      const { error } = await signInWithPassword({ email, password });
      if (error) {
        setAuthError(getAuthErrorMessage(error));
        return;
      }

      captureEvent("login_completed", {
        method: "password",
      });

      await ensureMinimumLoadingDuration(startedAt);
      navigate("/app", { replace: true });
    } catch (error) {
      Sentry.captureException(error);
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");
    setIsSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setAuthError(getAuthErrorMessage(error));
        return;
      }

      captureEvent("login_completed", {
        method: "google",
        oauth_redirect_started: true,
      });
    } catch (error) {
      Sentry.captureException(error);
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className={styles.container}>
      <LoginForm
        flow={flow}
        logoSrc={logo}
        googleIconSrc={googleIcon}
        onPasswordSubmit={handlePasswordSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        authError={authError}
        isSubmitting={isSubmitting}
      />

      <div className={styles.assetContainer}>
        <img src={pageImage} alt="Page visual" loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
