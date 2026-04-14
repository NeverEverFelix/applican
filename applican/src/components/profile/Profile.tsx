import type { User } from "@supabase/supabase-js";
import { useAuthSession } from "../../features/auth/AuthSessionContext";
import styles from "./Profile.module.css";
import { useChangeEmail } from "./changeEmail";
import { useChangePassword } from "./changePassword";
import { useProfessionalSummary } from "./professionalSummary";

function getNameParts(user: User | null) {
  const fullName =
    typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : typeof user?.user_metadata?.name === "string" && user.user_metadata.name.trim()
        ? user.user_metadata.name.trim()
        : "";

  if (!fullName) {
    return { firstName: "", lastName: "" };
  }

  const [firstName = "", ...rest] = fullName.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export default function Profile() {
  const { session } = useAuthSession();
  const user = session?.user ?? null;
  const { firstName, lastName } = getNameParts(user);
  const email = user?.email ?? "";
  const { summary, setSummary, persistSummary, isOverLimit } = useProfessionalSummary(user?.id ?? null);
  const {
    emailDraft,
    setEmailDraft,
    submitChange: submitChangeEmail,
    canSubmit: canChangeEmail,
    isInvalid: isEmailInvalid,
  } = useChangeEmail(email);
  const {
    submitChange: submitChangePassword,
    isSubmitting: isChangingPassword,
    canSubmit: canChangePassword,
  } = useChangePassword(email);

  const handleResetPassword = () => {
    void submitChangePassword();
  };
  const handleCancelSubscription = () => {
    // Placeholder for future cancel-subscription flow.
  };

  return (
    <section className={styles.profileView}>
      <div className={styles.profileColumn}>
        <div className={styles.nameRow}>
          <input type="text" className={styles.firstNameTextbox} defaultValue={firstName} />
          <input type="text" className={styles.lastNameTextbox} defaultValue={lastName} />
        </div>
        <div className={styles.emailRow}>
          <input
            type="text"
            className={styles.emailTextbox}
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
          />
          <button
            type="button"
            className={[
              styles.changeEmailLink,
              canChangeEmail ? styles.changeEmailLinkActive : "",
              isEmailInvalid ? styles.changeEmailLinkInvalid : "",
            ]
              .join(" ")
              .trim()}
            onClick={() => void submitChangeEmail()}
          >
            change email
          </button>
        </div>
        <div className={styles.professionalSummaryField}>
          <span
            className={[
              styles.professionalSummaryPlaceholder,
              summary.length > 0 ? styles.professionalSummaryPlaceholderHidden : "",
            ]
              .join(" ")
              .trim()}
          >
            Enter Professional Summary
          </span>
          <textarea
            className={[styles.professionalSummaryTextbox, isOverLimit ? styles.professionalSummaryTextboxInvalid : ""].join(" ").trim()}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            onBlur={() => {
              void persistSummary();
            }}
          />
        </div>
        <button
          type="button"
          className={styles.profileActionLink}
          onClick={handleResetPassword}
          disabled={!canChangePassword}
        >
          {isChangingPassword ? "sending..." : "change password"}
        </button>
        <button type="button" className={styles.cancelSubscriptionLink} onClick={handleCancelSubscription}>
          cancel subscription
        </button>
      </div>
    </section>
  );
}
