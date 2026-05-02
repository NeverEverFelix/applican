import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./HomePage.module.css";
import starIcon from "../assets/Star.png";
import hamburgerIcon from "../assets/Hamburger.png";
import careerPathIcon from "../assets/Vector (1).png";
import resourcesIcon from "../assets/oblong.png";
import helpIcon from "../assets/Help.svg";
import UserMenu from "../components/UserMenu/UserMenu";
import { useCurrentUserName, useCurrentUserPlan } from "../features/auth/useCurrentUser";
import AuthLoadingScreen from "../features/auth/AuthLoadingScreen";
import { useMinimumLoading } from "../features/auth/useMinimumLoading";
import userStyles from "../components/UserInfo.module.css";
import UserInfoCard from "../components/UserInfoCard";
import ApplicationTracker from "../features/applicationTracker/ui/applicationTracker";
import type { PickerView } from "../features/applicationTracker/ui/studioContainerView";
import AppModal from "../components/Modal/Modal";
import { supabase } from "../lib/supabaseClient";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import { useUpgradeGate } from "../hooks/useUpgradeGate";
import { createCheckoutSession } from "../features/billing/api/createCheckoutSession";
import { createPortalSession } from "../features/billing/api/createPortalSession";
import { useViewport } from "../hooks/useViewport";
import { captureEvent } from "../posthog";
import {
  getStudioViewAvailabilityLabel,
  getStudioViewPolicy,
  isStudioViewSupportedOn,
  resolveSupportedStudioView,
} from "../features/applicationTracker/ui/studioViewPolicy";

function isPickerView(value: unknown): value is PickerView {
  return (
    value === "Resume Studio" ||
    value === "Application Tracker" ||
    value === "Profile" ||
    value === "History" ||
    value === "Career Path" ||
    value === "Editor" ||
    value === "Resources"
  );
}

export default function HomePage() {
  const [selectedView, setSelectedView] = useLocalStorageState<PickerView>(
    "applican:selected-view",
    "Resume Studio",
    { validate: isPickerView },
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isUpgradeModalOpen, isUserMenuOpen, setIsUserMenuOpen, openUpgradeModal, closeUpgradeModalAndOpenMenu } =
    useUpgradeGate();
  const showLoading = useMinimumLoading(isLoggingOut);
  const navigate = useNavigate();
  const location = useLocation();
  const { bucket, isMobile } = useViewport();
  const currentUserName = useCurrentUserName();
  const currentUserPlan = useCurrentUserPlan();
  const pickerItems: Array<{ label: PickerView; iconSrc: string }> = [
    { label: "Resume Studio", iconSrc: starIcon },
    { label: "Application Tracker", iconSrc: hamburgerIcon },
    { label: "Editor", iconSrc: starIcon },
    { label: "Career Path", iconSrc: careerPathIcon },
    { label: "Resources", iconSrc: resourcesIcon },
  ];
  const isProUser = currentUserPlan === "pro";

  const isViewRestricted = (view: PickerView) =>
    view !== "Resume Studio" && view !== "Application Tracker" && view !== "Profile" && view !== "History";

  const onSelectView = (view: PickerView) => {
    if (!isStudioViewSupportedOn(view, bucket)) {
      return;
    }

    if (!isProUser && isViewRestricted(view)) {
      captureEvent("upgrade_prompt_opened", {
        source: "restricted_view",
        target_view: view,
        viewport_bucket: bucket,
      });
      openUpgradeModal();
      return;
    }

    setSelectedView(view);
  };

  useEffect(() => {
    const resolvedView = resolveSupportedStudioView(selectedView, bucket);
    if (resolvedView !== selectedView) {
      setSelectedView(resolvedView);
    }
  }, [bucket, selectedView, setSelectedView]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleUpgrade = async (source = "unknown") => {
    captureEvent("checkout_session_requested", { source });

    try {
      const checkoutUrl = await createCheckoutSession();
      captureEvent("checkout_session_created", { source });
      window.location.assign(checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create checkout session.";
      captureEvent("checkout_session_failed", { source, message });
      throw error;
    }
  };

  const handleBilling = async (source = "unknown") => {
    captureEvent("billing_portal_session_requested", { source });

    try {
      const portalUrl = await createPortalSession();
      captureEvent("billing_portal_session_created", { source });
      window.location.assign(portalUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create billing portal session.";
      captureEvent("billing_portal_session_failed", { source, message });
      throw error;
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const checkoutState = searchParams.get("checkout");
    if (!checkoutState) {
      return;
    }

    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete("checkout");
    nextSearchParams.delete("session_id");
    const nextSearch = nextSearchParams.toString();
    const hasSessionId = Boolean(searchParams.get("session_id"));

    if (checkoutState === "success") {
      captureEvent("checkout_completed", {
        source: "stripe_checkout_return",
        has_session_id: hasSessionId,
      });
      void supabase.auth.refreshSession().finally(() => {
        navigate(
          {
            pathname: location.pathname,
            search: nextSearch ? `?${nextSearch}` : "",
          },
          { replace: true },
        );
      });
      return;
    }

    captureEvent("checkout_canceled", {
      source: "stripe_checkout_return",
      has_session_id: hasSessionId,
    });

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.userInfoContainer}>
        <UserMenu
          user={{ name: currentUserName, plan: currentUserPlan }}
          onSignOut={() => void handleLogout()}
          onUpgrade={handleUpgrade}
          onBilling={handleBilling}
          showMobileNavigationItems={isMobile}
          onResumeStudioSelect={() => onSelectView("Resume Studio")}
          onApplicationTrackerSelect={() => onSelectView("Application Tracker")}
          onProfileSelect={() => onSelectView("Profile")}
          onHistorySelect={() => onSelectView("History")}
          isSigningOut={isLoggingOut}
          open={isUserMenuOpen}
          onOpenChange={setIsUserMenuOpen}
        />
        {!isMobile ? (
          <div className={styles.sidebarControls}>
            <div className={userStyles.stateControlStack}>
              {pickerItems.map((item) => {
                const isSupportedOnCurrentViewport = isStudioViewSupportedOn(item.label, bucket);
                const policy = getStudioViewPolicy(item.label);
                const availabilityLabel = getStudioViewAvailabilityLabel(item.label, bucket);

                return (
                  <button
                    type="button"
                    key={item.label}
                    className={[
                      userStyles.stateControlItem,
                      !isSupportedOnCurrentViewport ? userStyles.stateControlItemUnavailable : "",
                      selectedView === item.label ? userStyles.stateControlItemActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSelectView(item.label)}
                    disabled={!isSupportedOnCurrentViewport}
                    aria-disabled={!isSupportedOnCurrentViewport}
                    title={!isSupportedOnCurrentViewport ? policy.unavailableTitle : undefined}
                    aria-pressed={selectedView === item.label}
                  >
                    <img
                      src={item.iconSrc}
                      alt=""
                      aria-hidden="true"
                      className={[
                        userStyles.stateControlIcon,
                        !isSupportedOnCurrentViewport ? userStyles.stateControlIconUnavailable : "",
                        item.label === "Editor" ? userStyles.stateControlIconPurple : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <div className={userStyles.stateControlLabelRow}>
                      <p
                        className={[
                          userStyles.stateControlLabel,
                          !isSupportedOnCurrentViewport ? userStyles.stateControlLabelUnavailable : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {item.label}
                      </p>
                      {availabilityLabel ? (
                        <span
                          className={[
                            userStyles.stateControlSoonLabel,
                            !isSupportedOnCurrentViewport ? userStyles.stateControlAvailabilityUnavailable : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {availabilityLabel}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
            <a
              href="https://tally.so/r/441r7b"
              target="_blank"
              rel="noreferrer"
              className={[userStyles.stateControlItem, styles.supportLink].join(" ")}
            >
              <img
                src={helpIcon}
                alt=""
                aria-hidden="true"
                className={userStyles.stateControlIcon}
              />
              <span className={userStyles.stateControlLabel}>Support</span>
            </a>
          </div>
        ) : null}
      </div>
      <div className={styles.studioArea}>
        {selectedView === "Profile" ? (
          <div className={styles.studioUserCard}>
            <UserInfoCard user={{ name: currentUserName, plan: currentUserPlan }} />
          </div>
        ) : null}
        <ApplicationTracker selectedView={selectedView} onSelectView={onSelectView} />
      </div>
      <AppModal open={isUpgradeModalOpen} onClose={closeUpgradeModalAndOpenMenu} />
    </div>
  );
}
