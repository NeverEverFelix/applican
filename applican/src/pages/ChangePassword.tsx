import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./ChangePassword.module.css";
import pageImage from "../assets/PageImage.png";
import logo from "../assets/logo.png";
import AuthLoadingScreen from "../features/auth/AuthLoadingScreen";
import { useAuthSession } from "../features/auth/AuthSessionContext";
import { getAuthErrorMessage } from "../features/auth/auth";
import { useMinimumLoading } from "../features/auth/useMinimumLoading";
import { supabase } from "../lib/supabaseClient";

const SUCCESS_REDIRECT_DELAY_MS = 1500;

function getHashParams(hash: string) {
  return new URLSearchParams(hash.replace(/^#/, ""));
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isChecking } = useAuthSession();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const hashParams = useMemo(() => getHashParams(location.hash), [location.hash]);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hasRecoveryHash =
    hashParams.get("type") === "recovery" || Boolean(hashParams.get("access_token"));
  const recoveryError = hashParams.get("error_description") ?? searchParams.get("error_description") ?? "";
  const canSubmit = password.trim().length > 0 && Boolean(session) && !isSubmitting;
  const showLoading = useMinimumLoading(isChecking || isSubmitting);

  useEffect(() => {
    if (recoveryError) {
      setErrorMessage(decodeURIComponent(recoveryError.replace(/\+/g, " ")));
      return;
    }

    if (isChecking) {
      return;
    }

    if (!session && hasRecoveryHash) {
      setErrorMessage("This password reset link is invalid or expired. Request a new one and try again.");
      return;
    }

    if (session) {
      setErrorMessage("");
    }
  }, [hasRecoveryHash, isChecking, recoveryError, session]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
  };

  const handlePasswordChange = async () => {
    if (!canSubmit) {
      return;
    }

    setStatusMessage("");
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMessage(getAuthErrorMessage(error));
        return;
      }

      setStatusMessage("Password updated. Redirecting...");
      window.setTimeout(() => {
        navigate("/app", { replace: true });
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className={styles.container}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          handleSubmit(event);
          void handlePasswordChange();
        }}
      >
        <div className={styles.header}>
          <img src={logo} alt="Logo" className={styles.logo} />
          <p className={styles.mainText}>Change Password</p>
        </div>

        <div className={styles.main}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            className={styles.password}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={isChecking || isSubmitting || !session}
          />
          <button type="submit" className={styles.continue} disabled={!canSubmit}>
            {isSubmitting ? "Updating..." : "Continue"}
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
