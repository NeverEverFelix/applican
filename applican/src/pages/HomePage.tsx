import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./HomePage.module.css";
import starIcon from "../assets/Star.png";
import hamburgerIcon from "../assets/Hamburger.png";
import careerPathIcon from "../assets/Vector (1).png";
import resourcesIcon from "../assets/oblong.png";
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
  const currentUserName = useCurrentUserName();
  const currentUserPlan = useCurrentUserPlan();
  const pickerItems: Array<{ label: PickerView; iconSrc: string }> = [
    { label: "Resume Studio", iconSrc: starIcon },
    { label: "Application Tracker", iconSrc: hamburgerIcon },
    { label: "Career Path", iconSrc: careerPathIcon },
    { label: "Editor", iconSrc: starIcon },
    { label: "Resources", iconSrc: resourcesIcon },
  ];
  const isProUser = currentUserPlan === "pro";

  const isViewRestricted = (view: PickerView) =>
    view !== "Resume Studio" && view !== "Application Tracker" && view !== "Profile" && view !== "History";

  const onSelectView = (view: PickerView) => {
    if (!isProUser && isViewRestricted(view)) {
      openUpgradeModal();
      return;
    }

    setSelectedView(view);
  };

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

  const handleUpgrade = async () => {
    const checkoutUrl = await createCheckoutSession();
    window.location.assign(checkoutUrl);
  };

  const handleBilling = async () => {
    const portalUrl = await createPortalSession();
    window.location.assign(portalUrl);
  };

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
          onProfileSelect={() => onSelectView("Profile")}
          onHistorySelect={() => onSelectView("History")}
          isSigningOut={isLoggingOut}
          open={isUserMenuOpen}
          onOpenChange={setIsUserMenuOpen}
        />
        <div className={userStyles.stateControlStack}>
          {pickerItems.map((item) => (
            <div
              key={item.label}
              role="button"
              tabIndex={0}
              className={[
                userStyles.stateControlItem,
                selectedView === item.label ? userStyles.stateControlItemActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectView(item.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectView(item.label);
                }
              }}
              aria-pressed={selectedView === item.label}
            >
              <img
                src={item.iconSrc}
                alt=""
                aria-hidden="true"
                className={[
                  userStyles.stateControlIcon,
                  item.label === "Editor" ? userStyles.stateControlIconPurple : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <div className={userStyles.stateControlLabelRow}>
                <p className={userStyles.stateControlLabel}>{item.label}</p>
                {item.label === "Career Path" || item.label === "Resources" ? (
                  <span className={userStyles.stateControlSoonLabel}>Coming soon</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.studioArea}>
        {selectedView === "Profile" ? (
          <div className={styles.studioUserCard}>
            <UserInfoCard user={{ name: currentUserName, plan: currentUserPlan }} />
          </div>
        ) : null}
        <ApplicationTracker selectedView={selectedView} />
      </div>
      <AppModal open={isUpgradeModalOpen} onClose={closeUpgradeModalAndOpenMenu} />
    </div>
  );
}
