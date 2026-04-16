import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuthSession } from "../features/auth/useAuthSession";
import { isEmailVerifiedSession } from "../features/auth/emailVerification";
import styles from "./VerifyEmailPage.module.css";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  if (isEmailVerifiedSession(session)) {
    return <Navigate to="/app" replace />;
  }

  const userEmail = session?.user.email ?? "";

  const handleResend = async () => {
    if (!userEmail || isWorking) {
      return;
    }

    setStatusMessage("");
    setErrorMessage("");
    setIsWorking(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setStatusMessage("Verification email sent. Check your inbox.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (isWorking) {
      return;
    }

    setStatusMessage("");
    setErrorMessage("");
    setIsWorking(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setStatusMessage("Status refreshed. If verified, you will be redirected.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleLogout = async () => {
    if (isWorking) {
      return;
    }

    setIsWorking(true);
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <h1 className={styles.title}>Verify your email</h1>
        <p className={styles.body}>
          Please verify your email before using the app.
          {userEmail ? (
            <>
              {" "}
              We sent a link to <span className={styles.email}>{userEmail}</span>.
            </>
          ) : null}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void handleRefreshStatus()} disabled={isWorking}>
            I verified, continue
          </button>
          <button type="button" className={styles.secondary} onClick={() => void handleResend()} disabled={isWorking || !userEmail}>
            Resend email
          </button>
          <button type="button" className={styles.ghost} onClick={() => void handleLogout()} disabled={isWorking}>
            Log out
          </button>
        </div>

        {statusMessage ? <p className={`${styles.message} ${styles.success}`}>{statusMessage}</p> : null}
        {errorMessage ? <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p> : null}
      </section>
    </div>
  );
}
