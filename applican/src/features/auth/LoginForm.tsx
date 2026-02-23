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
};

export default function LoginForm({
  flow,
  logoSrc,
  googleIconSrc,
  onPasswordSubmit,
  onGoogleSignIn,
}: LoginFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (flow.step === "email") {
      const result = flow.onContinue();
      if (result === "advanced_to_password") {
        console.log("Email validation successful:", flow.email.trim().toLowerCase());
      }
      return;
    }

    onPasswordSubmit?.({ email: flow.email, password: flow.password });
  };

  const isPasswordStep = flow.step === "password";
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
        <button type="submit" className={styles.continue}>
          Continue
        </button>
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
    </form>
  );
}
