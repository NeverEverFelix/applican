import type { FormEvent } from "react";
import type { UseSignupFlow } from "./useSignupFlow";
import styles from "../../pages/SignupPage.module.css";
import { Button, FormField, Input, Label } from "../../components/ui";

type SignupFormProps = {
  flow: UseSignupFlow;
  logoSrc: string;
  googleIconSrc: string;
  onSubmit?: (payload: { email: string; name: string; jobRole: string; password: string }) => void;
  onGoogleSignIn?: () => void;
  authError?: string;
  successMessage?: string;
  isSubmitting?: boolean;
};

export default function SignupForm({
  flow,
  logoSrc,
  googleIconSrc,
  onSubmit,
  onGoogleSignIn,
  authError,
  successMessage,
  isSubmitting = false,
}: SignupFormProps) {
  const isPasswordStep = flow.step === "password";
  const canContinue =
    flow.isEmailValid && flow.name.trim().length > 0 && flow.jobRole.trim().length > 0;
  const canSignUp = flow.password.trim().length > 0;

  const emailClassName = `${styles.email} ${
    flow.isEmailValid ? styles.emailValidated : flow.isEmailInvalid ? styles.emailInvalid : ""
  }`;
  const nameClassName = `${styles.name} ${
    flow.isNameComplete ? styles.emailValidated : flow.isNameInvalid ? styles.emailInvalid : ""
  }`;
  const jobRoleClassName = `${styles.jobrole} ${
    flow.isJobRoleComplete ? styles.emailValidated : flow.isJobRoleInvalid ? styles.emailInvalid : ""
  }`;
  const inputClassName = isPasswordStep ? styles.password : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPasswordStep || !canSignUp) {
      return;
    }
    onSubmit?.({ email: flow.email, name: flow.name, jobRole: flow.jobRole, password: flow.password });
  };

  const handleContinue = () => {
    if (!canContinue || isSubmitting) {
      return;
    }
    flow.onContinue();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.contentStack}>
        <div className={styles.header}>
          <img src={logoSrc} alt="Logo" className={styles.logo} />
          <p className={styles.mainText}>Create An Account</p>
          <p className={styles.subText}>
            Join hundreds of others speeding up their job search using Applican.
          </p>
        </div>

        <div className={styles.main}>
          {!isPasswordStep && (
            <div className={styles.inputGroup}>
              <Label htmlFor="signup-email" className="sr-only">
                Email
              </Label>
              <Input
                id="signup-email"
                type="email"
                name="email"
                placeholder="Email"
                autoComplete="email"
                className={emailClassName}
                invalid={flow.isEmailInvalid}
                value={flow.email}
                onChange={(event) => flow.onEmailChange(event.target.value)}
              />

              <Label htmlFor="signup-name" className="sr-only">
                Full name
              </Label>
              <Input
                id="signup-name"
                type="text"
                name="name"
                placeholder="Full Name"
                autoComplete="name"
                className={nameClassName}
                invalid={flow.isNameInvalid}
                value={flow.name}
                onChange={(event) => flow.onNameChange(event.target.value)}
                onBlur={flow.onNameBlur}
              />

              <Label htmlFor="signup-jobrole" className="sr-only">
                Job role
              </Label>
              <Input
                id="signup-jobrole"
                type="text"
                name="jobrole"
                placeholder="Job role"
                autoComplete="organization-title"
                className={jobRoleClassName}
                invalid={flow.isJobRoleInvalid}
                value={flow.jobRole}
                onChange={(event) => flow.onJobRoleChange(event.target.value)}
              />
            </div>
          )}

          <FormField
            errorMessage={authError}
            errorClassName={styles.formMessageError}
            successMessage={successMessage}
            successClassName={styles.formMessageSuccess}
          >
            {isPasswordStep ? (
              <>
                <Label htmlFor="signup-password" className="sr-only">
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  name="password"
                  placeholder="Password"
                  autoComplete="new-password"
                  className={inputClassName}
                  value={flow.password}
                  onChange={(event) => flow.onPasswordChange(event.target.value)}
                />
              </>
            ) : null}

            {!isPasswordStep ? (
              <Button
                type="button"
                className={styles.continue}
                disabled={!canContinue || isSubmitting}
                onClick={handleContinue}
              >
                Continue
              </Button>
            ) : null}
            {isPasswordStep ? (
              <Button
                type="submit"
                className={styles.continue}
                disabled={!canSignUp || isSubmitting}
              >
                {isSubmitting ? "Signing up..." : "Sign Up"}
              </Button>
            ) : null}
          </FormField>
        </div>

        {!isPasswordStep && (
          <div className={styles.footer}>
            <p className={styles.orText}>OR</p>
            <Button type="button" variant="secondary" className={styles.AltLogin} onClick={() => onGoogleSignIn?.()}>
              <img src={googleIconSrc} alt="Google" />
              <span>Continue with Google</span>
            </Button>
          </div>
        )}
      </div>

      {isPasswordStep && (
        <div className={styles.passwordStepActions}>
          <Button
            type="button"
            variant="link"
            className={styles.secondaryLink}
            onClick={flow.goToDetailsStep}
          >
            Change details
          </Button>
        </div>
      )}
    </form>
  );
}
