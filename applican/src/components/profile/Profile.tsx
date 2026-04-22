import { useState } from "react";
import { usePostHog } from "@posthog/react";
import type { User } from "@supabase/supabase-js";
import { useAuthSession } from "../../features/auth/useAuthSession";
import StatusNotice from "../feedback/StatusNotice";
import styles from "./Profile.module.css";
import { useChangeEmail } from "./changeEmail";
import { useChangeName } from "./changeName";
import { useChangePassword } from "./changePassword";
import { useProfessionalSummary } from "./professionalSummary";
import { cancelSubscription } from "../../features/billing/api/cancelSubscription";
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
  const [isCancellationPending, setIsCancellationPending] = useState(false);
  const [cancellationState, setCancellationState] = useState<"idle" | "scheduled">("idle");
  const [cancellationError, setCancellationError] = useState("");
  const { firstName, lastName } = getNameParts(user);
  const email = user?.email ?? "";
  const userPlan = typeof user?.app_metadata?.plan === "string" ? user.app_metadata.plan.trim().toLowerCase() : "";
  const hasCancelableSubscription = userPlan === "pro";
  const {
    firstNameDraft,
    setFirstNameDraft,
    lastNameDraft,
    setLastNameDraft,
    submitChange: submitNameChange,
    isSubmitting: isChangingName,
    canSubmit: canChangeName,
    statusMessage: nameStatusMessage,
    errorMessage: nameErrorMessage,
  } = useChangeName(firstName, lastName);
  const {
    summary,
    setSummary,
    persistSummary,
    isOverLimit,
    isSaving: isSummarySaving,
    statusMessage: summaryStatusMessage,
    errorMessage: summaryErrorMessage,
  } = useProfessionalSummary(user?.id ?? null);
  const {
    emailDraft,
    setEmailDraft,
    submitChange: submitChangeEmail,
    isSubmitting: isChangingEmail,
    canSubmit: canChangeEmail,
    isInvalid: isEmailInvalid,
    statusMessage: emailStatusMessage,
    errorMessage: emailErrorMessage,
  } = useChangeEmail(email);
  const {
    submitChange: submitChangePassword,
    isSubmitting: isChangingPassword,
    canSubmit: canChangePassword,
    statusMessage: passwordStatusMessage,
    errorMessage: passwordErrorMessage,
  } = useChangePassword(email);

  const handleResetPassword = () => {
    void submitChangePassword();
  };
  const handleCancelSubscription = async () => {
    if (!hasCancelableSubscription || isCancellationPending || cancellationState === "scheduled") {
      return;
    }

    setCancellationError("");
    setIsCancellationPending(true);
    posthog?.capture("subscription_cancel_clicked", { source: "profile_cancel_subscription" });

    try {
      await cancelSubscription();
      setCancellationState("scheduled");
      posthog?.capture("subscription_cancel_scheduled", {
        source: "profile_cancel_subscription",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel subscription.";
      setCancellationError(message);
      posthog?.capture("subscription_cancel_failed", {
        source: "profile_cancel_subscription",
        message,
      });
    } finally {
      setIsCancellationPending(false);
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
          <input
            type="text"
            className={styles.firstNameTextbox}
            value={firstNameDraft}
            onChange={(event) => setFirstNameDraft(event.target.value)}
            aria-label="First name"
          />
          <div className={styles.nameActionGroup}>
            <input
              type="text"
              className={styles.lastNameTextbox}
              value={lastNameDraft}
              onChange={(event) => setLastNameDraft(event.target.value)}
              aria-label="Last name"
            />
            <button
              type="button"
              className={[
                styles.changeEmailLink,
                canChangeName ? styles.changeEmailLinkActive : "",
              ]
                .join(" ")
                .trim()}
              onClick={() => void submitNameChange()}
              disabled={!canChangeName}
            >
              {isChangingName ? "saving..." : "save name"}
            </button>
          </div>
        </div>
        {nameStatusMessage ? <StatusNotice tone="success" message={nameStatusMessage} className={styles.profileNotice} /> : null}
        {nameErrorMessage ? <StatusNotice tone="error" message={nameErrorMessage} className={styles.profileNotice} /> : null}
        <div className={styles.emailRow}>
          <input
            type="email"
            className={styles.emailTextbox}
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            aria-label="Email address"
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
            disabled={!canChangeEmail}
          >
            {isChangingEmail ? "sending..." : "change email"}
          </button>
        </div>
        {emailStatusMessage ? <StatusNotice tone="success" message={emailStatusMessage} className={styles.profileNotice} /> : null}
        {emailErrorMessage ? <StatusNotice tone="error" message={emailErrorMessage} className={styles.profileNotice} /> : null}
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
            aria-label="Professional summary"
          />
        </div>
        {isOverLimit ? (
          <StatusNotice
            tone="warning"
            message="Professional summary is over the 325 character limit. Shorten it to save changes."
            className={styles.profileNotice}
          />
        ) : null}
        {!isOverLimit && isSummarySaving ? (
          <StatusNotice tone="info" message="Saving professional summary..." className={styles.profileNotice} />
        ) : null}
        {!isOverLimit && summaryStatusMessage ? (
          <StatusNotice tone="success" message={summaryStatusMessage} className={styles.profileNotice} />
        ) : null}
        {!isOverLimit && summaryErrorMessage ? (
          <StatusNotice tone="error" message={summaryErrorMessage} className={styles.profileNotice} />
        ) : null}
        <button
          type="button"
          className={styles.profileActionLink}
          onClick={handleResetPassword}
          disabled={!canChangePassword}
        >
          {isChangingPassword ? "sending..." : "change password"}
        </button>
        {passwordStatusMessage ? <StatusNotice tone="success" message={passwordStatusMessage} className={styles.profileNotice} /> : null}
        {passwordErrorMessage ? <StatusNotice tone="error" message={passwordErrorMessage} className={styles.profileNotice} /> : null}
        <button
          type="button"
          className={styles.cancelSubscriptionLink}
          onClick={() => void handleCancelSubscription()}
          disabled={!hasCancelableSubscription || isCancellationPending || cancellationState === "scheduled"}
          aria-disabled={!hasCancelableSubscription || isCancellationPending || cancellationState === "scheduled"}
        >
          {hasCancelableSubscription
            ? cancellationState === "scheduled"
              ? "cancellation scheduled"
              : isCancellationPending
                ? "scheduling cancellation..."
                : "cancel subscription"
            : "no active subscription"}
        </button>
        {cancellationState === "scheduled" ? (
          <StatusNotice
            tone="success"
            message="Your subscription will cancel at the end of the current billing period."
            className={styles.profileNotice}
          />
        ) : null}
        {cancellationError ? <StatusNotice tone="error" message={cancellationError} className={styles.profileNotice} /> : null}
      </div>
    </section>
  );
}
