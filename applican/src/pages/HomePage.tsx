import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./HomePage.module.css";
import starIcon from "../assets/Star.png";
import hamburgerIcon from "../assets/Hamburger.png";
import careerPathIcon from "../assets/Vector (1).png";
import resourcesIcon from "../assets/oblong.png";
import UserInfoCard from "../components/UserInfoCard";
import { useCurrentUserName } from "../features/auth/useCurrentUser";
import AuthLoadingScreen from "../features/auth/AuthLoadingScreen";
import { useMinimumLoading } from "../features/auth/useMinimumLoading";
import userStyles from "../components/UserInfo.module.css";
import ApplicationTracker from "../features/applicationTracker/ui/applicationTracker";
import type { PickerView } from "../features/applicationTracker/ui/studioContainerView";
import { supabase } from "../lib/supabaseClient";
import { useLocalStorageState } from "../hooks/useLocalStorageState";

function isPickerView(value: unknown): value is PickerView {
  return (
    value === "Resume Studio" ||
    value === "Application Tracker" ||
    value === "Career Path" ||
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
  const showLoading = useMinimumLoading(isLoggingOut);
  const navigate = useNavigate();
  const currentUserName = useCurrentUserName();
  const pickerItems: Array<{ label: PickerView; iconSrc: string }> = [
    { label: "Resume Studio", iconSrc: starIcon },
    { label: "Application Tracker", iconSrc: hamburgerIcon },
    { label: "Career Path", iconSrc: careerPathIcon },
    { label: "Resources", iconSrc: resourcesIcon },
  ];

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

  if (showLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.userInfoContainer}>
        <UserInfoCard user={{ name: currentUserName }} />
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
              onClick={() => setSelectedView(item.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedView(item.label);
                }
              }}
              aria-pressed={selectedView === item.label}
            >
              <img src={item.iconSrc} alt="" aria-hidden="true" className={userStyles.stateControlIcon} />
              <p className={userStyles.stateControlLabel}>{item.label}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={userStyles.logoutButton}
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>
      <ApplicationTracker selectedView={selectedView} />
    </div>
  );
}
