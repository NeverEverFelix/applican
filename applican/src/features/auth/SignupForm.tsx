import type { FormEvent } from "react";
import type { UseSignupFlow } from "./useSignupFlow";
import styles from "../../pages/SignupPage.module.css";

type SignupFormProps = {
  flow: UseSignupFlow;
  logoSrc: string;
  googleIconSrc: string;
  onSubmit?: (payload: { email: string; name: string; jobRole: string }) => void;
  onGoogleSignIn?: () => void;
};

export default function SignupForm({
  flow,
  logoSrc,
  googleIconSrc,
  onSubmit,
  onGoogleSignIn,
}: SignupFormProps) {
  const canSubmit =
    flow.isEmailValid &&
    flow.name.trim().length > 0 &&
    flow.jobRole.trim().length > 0;

  const emailClassName = `${styles.email} ${
    flow.isEmailValid ? styles.emailValidated : flow.isEmailInvalid ? styles.emailInvalid : ""
  }`;
  const nameClassName = `${styles.name} ${flow.isNameComplete ? styles.emailValidated : ""}`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSubmit?.({ email: flow.email, name: flow.name, jobRole: flow.jobRole });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <img src={logoSrc} alt="Logo" className={styles.logo} />
        <p className={styles.mainText}>Create An Account</p>
        <p className={styles.subText}>
          Join hundreds of others speeding up their job search using Applican.
        </p>
      </div>

      <div className={styles.main}>
        <div className={styles.inputGroup}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            autoComplete="email"
            className={emailClassName}
            value={flow.email}
            onChange={(event) => flow.onEmailChange(event.target.value)}
          />

          <input
            type="text"
            name="name"
            placeholder="Full Name"
            autoComplete="name"
            className={nameClassName}
            value={flow.name}
            onChange={(event) => flow.onNameChange(event.target.value)}
            onBlur={flow.onNameBlur}
          />

          <input
            type="text"
            name="jobrole"
            placeholder="Job role"
            autoComplete="organization-title"
            className={styles.jobrole}
            value={flow.jobRole}
            onChange={(event) => flow.onJobRoleChange(event.target.value)}
          />
        </div>

        <button type="submit" className={styles.continue} disabled={!canSubmit}>
          Sign Up
        </button>
      </div>

      <div className={styles.footer}>
        <p className={styles.orText}>OR</p>
        <button type="button" className={styles.AltLogin} onClick={() => onGoogleSignIn?.()}>
          <img src={googleIconSrc} alt="Google" />
          <span>Continue with Google</span>
        </button>
      </div>
    </form>
  );
}
