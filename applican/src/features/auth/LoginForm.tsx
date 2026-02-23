import { Link } from "react-router-dom";
import type { FormEvent } from "react";
import type { UseLoginFlow } from "./useLoginFlow";
import styles from "../../pages/LoginPage.module.css";

type LoginFormProps = {
  flow: UseLoginFlow;
  logoSrc: string;
  googleIconSrc: string;
  onPasswordSubmit?: (payload: { email: string; password: string }) => void;
  onGoogleSignIn?: () => void;
  authError?: string;
  isSubmitting?: boolean;
};

export default function LoginForm({
  flow,
  logoSrc,
  googleIconSrc,
  onPasswordSubmit,
  onGoogleSignIn,
  authError,
  isSubmitting = false,
}: LoginFormProps) {
  const isPasswordStep = flow.step === "password";
  const canSubmit = isPasswordStep
    ? flow.password.trim().length > 0
    : flow.isEmailValid;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    if (flow.step === "email") {
      flow.onContinue();
      return;
    }

    onPasswordSubmit?.({ email: flow.email, password: flow.password });
  };

  const emailClassName = `${styles.email} ${
    flow.isEmailValid ? styles.emailValidated : flow.isEmailInvalid ? styles.emailInvalid : ""
  }`;
  const inputClassName = isPasswordStep ? styles.password : emailClassName;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <img src={logoSrc} alt="Logo" className={styles.logo} />
        <p className={styles.mainText}>Welcome Back</p>
        <p className={styles.subText}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>

      <div className={styles.main}>
        <input
          type={isPasswordStep ? "password" : "email"}
          name={isPasswordStep ? "password" : "email"}
          placeholder={isPasswordStep ? "Password" : "Email"}
          className={inputClassName}
          value={isPasswordStep ? flow.password : flow.email}
          onChange={(event) => {
            if (isPasswordStep) {
              flow.onPasswordChange(event.target.value);
              return;
            }
            flow.onEmailChange(event.target.value);
          }}
          autoComplete={isPasswordStep ? "current-password" : "email"}
        />
        <button
          type="submit"
          className={styles.continue}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? "Continuing..." : "Continue"}
        </button>
        {authError ? <p className={styles.formMessageError}>{authError}</p> : null}
      </div>

      {!isPasswordStep && (
        <div className={styles.footer}>
          <p className={styles.orText}>OR</p>
          <button
            type="button"
            className={styles.AltLogin}
            onClick={() => onGoogleSignIn?.()}
          >
            <img src={googleIconSrc} alt="Google" />
            <span>Sign in with Google</span>
          </button>
          <a href="/forgot-password" className={styles.forgotPassword}>
            Forgot password?
          </a>
        </div>
      )}

      {isPasswordStep && (
        <div className={styles.passwordStepActions}>
          <button
            type="button"
            className={styles.secondaryLink}
            onClick={flow.goToEmailStep}
          >
            Change email
          </button>
        </div>
      )}
    </form>
  );
}
