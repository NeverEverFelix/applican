import { type ComponentType } from "react";
import styles from "./applicationTrack.module.css";
import type { PickerView } from "./studioContainerView";
import { ResumeStudioView } from "./views/ResumeStudioView";

function PlaceholderView({ title }: { title: string }) {
  return (
    <section className={styles.placeholderPanel}>
      <h2 className={styles.placeholderTitle}>{title}</h2>
      <p className={styles.placeholderCopy}>This view will be built inside the studio container.</p>
    </section>
  );
}

function ApplicationTrackerView() {
  const statusCounts = {
    all: 7,
    applied: 6,
    interview: 2,
    rejected: 1,
  };

  return (
    <section className={styles.trackerView}>
      <header className={styles.trackerHeader}>
        <div className={styles.statusPillGroup}>
          <button type="button" className={[styles.statusPill, styles.statusPillSelected].join(" ")}>
            All
            <span className={styles.statusCount}>{statusCounts.all}</span>
          </button>
          <button type="button" className={styles.statusPill}>
            Applied
            <span className={styles.statusCount}>{statusCounts.applied}</span>
          </button>
          <button type="button" className={styles.statusPill}>
            Interview
            <span className={styles.statusCount}>{statusCounts.interview}</span>
          </button>
          <button type="button" className={styles.statusPill}>
            Rejected
            <span className={styles.statusCount}>{statusCounts.rejected}</span>
          </button>
        </div>
      </header>
    </section>
  );
}

const STUDIO_CONTENT_BY_VIEW: Record<PickerView, ComponentType> = {
  "Resume Studio": ResumeStudioView,
  "Application Tracker": ApplicationTrackerView,
  "Career Path": () => <PlaceholderView title="Career Path" />,
  Resources: () => <PlaceholderView title="Resources" />,
};

type ApplicationTrackerContentProps = {
  selectedView: PickerView;
};

export function ApplicationTrackerContent({ selectedView }: ApplicationTrackerContentProps) {
  const SelectedView = STUDIO_CONTENT_BY_VIEW[selectedView];
  return <SelectedView />;
}
