import styles from "./SignupPage.module.css";
import logo from "../assets/logo.png";
import googleIcon from "../assets/GoogleIcon.png";
import pageImage from "../assets/PageImage.png";
import SignupForm from "../features/auth/SignupForm";
import AuthLoadingScreen from "../features/auth/AuthLoadingScreen";
import { useSignupFlow } from "../features/auth/useSignupFlow";
import { useMinimumLoading } from "../features/auth/useMinimumLoading";
import { useState } from "react";
import { getAuthErrorMessage, signInWithGoogle, signUpWithPassword } from "../features/auth/auth";
import { useNavigate } from "react-router-dom";

export default function SignupPage() {
  const flow = useSignupFlow();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showLoading = useMinimumLoading(isSubmitting);

  const handleSignup = async ({
    email,
    name,
    jobRole,
    password,
  }: {
    email: string;
    name: string;
    jobRole: string;
    password: string;
  }) => {
    setAuthError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const { data, error } = await signUpWithPassword({ email, name, jobRole, password });

    setIsSubmitting(false);
    if (error) {
      setAuthError(getAuthErrorMessage(error));
      return;
    }

    if (!data.session) {
      setSuccessMessage("Check your inbox and verify your email before continuing.");
      return;
    }

    navigate("/app", { replace: true });
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const { error } = await signInWithGoogle();
    if (error) {
      setAuthError(getAuthErrorMessage(error));
      setIsSubmitting(false);
      return;
    }
  };

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.assetContainer}>
        <img src={pageImage} alt="Page visual" />
      </div>

      <SignupForm
        flow={flow}
        logoSrc={logo}
        googleIconSrc={googleIcon}
        onSubmit={handleSignup}
        onGoogleSignIn={handleGoogleSignIn}
        authError={authError}
        successMessage={successMessage}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
