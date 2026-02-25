import styles from "./applicationTrack.module.css";
import { getStudioContainerVariant, type PickerView } from "./studioContainerView";
import { ApplicationTrackerContent } from "./applicationTrackerContent";

type ApplicationTrackerProps = {
  selectedView: PickerView;
};

export default function ApplicationTracker({ selectedView }: ApplicationTrackerProps) {
  const studioVariant = getStudioContainerVariant(selectedView);

  return (
    <div className={[styles.studioContainer, styles[studioVariant]].join(" ")}>
      <ApplicationTrackerContent selectedView={selectedView} />
    </div>
  );
}
