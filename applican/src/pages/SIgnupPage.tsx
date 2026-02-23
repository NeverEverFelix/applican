import styles from "./SignupPage.module.css";
import logo from "../assets/logo.png";
import googleIcon from "../assets/GoogleIcon.png";
import pageImage from "../assets/PageImage.png";
import SignupForm from "../features/auth/SignupForm";
import { useSignupFlow } from "../features/auth/useSignupFlow";
import { useState } from "react";
import { getAuthErrorMessage, signInWithGoogle, signUpWithPassword } from "../features/auth/auth";

export default function SignupPage() {
  const flow = useSignupFlow();
  const [authError, setAuthError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const { error } = await signUpWithPassword({ email, name, jobRole, password });

    setIsSubmitting(false);
    if (error) {
      setAuthError(getAuthErrorMessage(error));
      return;
    }

    setSuccessMessage("Account created. Check your email to confirm your account.");
    flow.reset();
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
