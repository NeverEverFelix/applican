import { useState } from "react";
import styles from "./applicationTrack.module.css";
import { getStudioContainerVariant, type PickerView } from "./studioContainerView";
import type { ApplicationTrackerStatus } from "./applicationTrackerContent";
import { ApplicationTrackerContent } from "./applicationTrackerContent";

type ApplicationTrackerProps = {
  selectedView: PickerView;
};

export default function ApplicationTracker({ selectedView }: ApplicationTrackerProps) {
  const studioVariant = getStudioContainerVariant(selectedView);
  const [selectedStatus, setSelectedStatus] = useState<ApplicationTrackerStatus>("all");

  return (
    <div className={[styles.studioContainer, styles[studioVariant]].join(" ")}>
      <ApplicationTrackerContent
        selectedView={selectedView}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
      />
    </div>
  );
}
