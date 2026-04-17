import { useState } from "react";
import { usePostHog } from "@posthog/react";
import type { User } from "@supabase/supabase-js";
import { useAuthSession } from "../../features/auth/useAuthSession";
import styles from "./Profile.module.css";
import { useChangeEmail } from "./changeEmail";
import { useChangePassword } from "./changePassword";
import { useProfessionalSummary } from "./professionalSummary";
import { createPortalSession } from "../../features/billing/api/createPortalSession";
import cancelIcon from "../../assets/cancel.svg";

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

type ProfileProps = {
  onClose?: () => void;
};

export default function Profile({ onClose }: ProfileProps) {
  const posthog = usePostHog();
  const { session } = useAuthSession();
  const user = session?.user ?? null;
  const [isSummaryFocused, setIsSummaryFocused] = useState(false);
  const [isBillingPortalPending, setIsBillingPortalPending] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState("");
  const { firstName, lastName } = getNameParts(user);
  const email = user?.email ?? "";
  const userPlan = typeof user?.app_metadata?.plan === "string" ? user.app_metadata.plan.trim().toLowerCase() : "";
  const hasCancelableSubscription = userPlan === "pro";
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
  const handleCancelSubscription = async () => {
    if (!hasCancelableSubscription || isBillingPortalPending) {
      return;
    }

    setBillingPortalError("");
    setIsBillingPortalPending(true);
    posthog?.capture("billing_portal_clicked", { source: "profile_cancel_subscription" });

    try {
      const portalUrl = await createPortalSession();
      window.location.assign(portalUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open billing portal.";
      setBillingPortalError(message);
      posthog?.capture("billing_portal_open_failed", {
        source: "profile_cancel_subscription",
        message,
      });
    } finally {
      setIsBillingPortalPending(false);
    }
  };

  return (
    <section className={styles.profileView}>
      <button
        type="button"
        className={styles.dismissButton}
        onClick={onClose}
        aria-label="Close profile and return to Resume Studio"
      >
        <img src={cancelIcon} alt="" className={styles.dismissIcon} />
      </button>
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
              isSummaryFocused || summary.length > 0 ? styles.professionalSummaryPlaceholderHidden : "",
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
            onFocus={() => setIsSummaryFocused(true)}
            onBlur={() => {
              setIsSummaryFocused(false);
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
        <button
          type="button"
          className={styles.cancelSubscriptionLink}
          onClick={() => void handleCancelSubscription()}
          disabled={!hasCancelableSubscription || isBillingPortalPending}
          aria-disabled={!hasCancelableSubscription || isBillingPortalPending}
        >
          {hasCancelableSubscription
            ? isBillingPortalPending
              ? "opening billing portal..."
              : "cancel subscription"
            : "no active subscription"}
        </button>
        {billingPortalError ? <p className={styles.billingPortalError}>{billingPortalError}</p> : null}
      </div>
    </section>
  );
}
