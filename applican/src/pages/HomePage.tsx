import { useState } from "react";
import styles from "./HomePage.module.css";
import starIcon from "../assets/Star.png";
import hamburgerIcon from "../assets/Hamburger.png";
import careerPathIcon from "../assets/Vector (1).png";
import resourcesIcon from "../assets/oblong.png";
import UserInfoCard from "../components/UserInfoCard";
import { useCurrentUserName } from "../features/auth/useCurrentUser";
import userStyles from "../components/UserInfo.module.css";
import ApplicationTracker from "../features/applicationTracker/ui/applicationTracker";
import type { PickerView } from "../features/applicationTracker/ui/studioContainerView";

export default function HomePage() {
  const [selectedView, setSelectedView] = useState<PickerView>("Resume Studio");
  const currentUserName = useCurrentUserName();
  const pickerItems: Array<{ label: PickerView; iconSrc: string }> = [
    { label: "Resume Studio", iconSrc: starIcon },
    { label: "Application Tracker", iconSrc: hamburgerIcon },
    { label: "Career Path", iconSrc: careerPathIcon },
    { label: "Resources", iconSrc: resourcesIcon },
  ];

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
      </div>
      <ApplicationTracker selectedView={selectedView} />
    </div>
  );
}
