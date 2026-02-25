import { type ComponentType, useMemo, useState } from "react";
import {
  APPLICATION_STATUS,
  formatAppliedDate,
  getApplicationFilterBucket,
  getNextApplicationStatus,
  type ApplicationFilter,
  type ApplicationStatus,
} from "../data/model";
import { getResumeDownloadUrl } from "../api/getResumeDownloadUrl";
import { useApplications } from "../data/useApplications";
import styles from "./applicationTrack.module.css";
import type { PickerView } from "./studioContainerView";
import { ResumeStudioView } from "./views/ResumeStudioView";
import downloadIcon from "../../../assets/Download Icon.png";

export type ApplicationTrackerStatus = ApplicationFilter;

function PlaceholderView({ title }: { title: string }) {
  return (
    <section className={styles.placeholderPanel}>
      <h2 className={styles.placeholderTitle}>{title}</h2>
      <p className={styles.placeholderCopy}>This view will be built inside the studio container.</p>
    </section>
  );
}

function ApplicationTrackerView({
  selectedStatus,
  onSelectStatus,
}: {
  selectedStatus: ApplicationTrackerStatus;
  onSelectStatus: (status: ApplicationTrackerStatus) => void;
}) {
  const { applications, counts, errorMessage, updateApplicationStatus, isUpdating } = useApplications();
  const [downloadingById, setDownloadingById] = useState<Record<string, boolean>>({});
  const applicationRows = useMemo(() => {
    if (selectedStatus === "all") {
      return applications;
    }
    return applications.filter((item) => getApplicationFilterBucket(item.status) === selectedStatus);
  }, [applications, selectedStatus]);

  const getStatusButtonClassName = (status: ApplicationStatus) => {
    if (status === APPLICATION_STATUS.READY_TO_APPLY) return styles.trackerStatusReady;
    if (status === APPLICATION_STATUS.APPLIED) return styles.trackerStatusApplied;
    if (status === APPLICATION_STATUS.INTERVIEW_1 || status === APPLICATION_STATUS.INTERVIEW_2) return styles.trackerStatusInterview;
    return styles.trackerStatusRejected;
  };

  const downloadResume = async (applicationId: string, fallbackFilename: string) => {
    setDownloadingById((prev) => ({ ...prev, [applicationId]: true }));
    try {
      const data = await getResumeDownloadUrl(applicationId);
      const link = document.createElement("a");
      link.href = data.signed_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = data.filename || fallbackFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDownloadingById((prev) => ({ ...prev, [applicationId]: false }));
    }
  };

  return (
    <section className={styles.trackerView}>
      <header className={styles.trackerHeader}>
        <div className={styles.statusPillGroup}>
          <button
            type="button"
            className={[styles.statusPill, selectedStatus === "all" ? styles.statusPillSelected : ""].join(" ").trim()}
            onClick={() => onSelectStatus("all")}
          >
            All
            <span className={styles.statusCount}>{counts.all}</span>
          </button>
          <button
            type="button"
            className={[styles.statusPill, selectedStatus === "applied" ? styles.statusPillSelected : ""].join(" ").trim()}
            onClick={() => onSelectStatus("applied")}
          >
            Applied
            <span className={styles.statusCount}>{counts.applied}</span>
          </button>
          <button
            type="button"
            className={[styles.statusPill, selectedStatus === "interview" ? styles.statusPillSelected : ""].join(" ").trim()}
            onClick={() => onSelectStatus("interview")}
          >
            Interview
            <span className={styles.statusCount}>{counts.interview}</span>
          </button>
          <button
            type="button"
            className={[styles.statusPill, selectedStatus === "rejected" ? styles.statusPillSelected : ""].join(" ").trim()}
            onClick={() => onSelectStatus("rejected")}
          >
            Rejected
            <span className={styles.statusCount}>{counts.rejected}</span>
          </button>
        </div>
      </header>
      <div className={styles.trackerTopDivider} aria-hidden="true" />

      <section className={styles.trackerColumns} aria-label="Applications grid">
        <div className={styles.trackerColumnHeader}>
          <span className={styles.trackerColumnCheckbox}>
            <input type="checkbox" className={styles.trackerHeaderCheckbox} aria-label="Select all applications" />
          </span>
          <span className={styles.trackerColumnLabel}>Company</span>
          <span className={styles.trackerColumnLabel}>Date Applied</span>
          <span className={styles.trackerColumnLabel}>Status</span>
          <span className={styles.trackerColumnLabel}>Position</span>
          <span className={styles.trackerColumnLabel}>Location</span>
          <span className={styles.trackerColumnLabel}>Resume</span>
        </div>
        <div className={styles.trackerHeaderDivider} aria-hidden="true" />
        <div className={styles.trackerGridBody}>
          {errorMessage ? <p className={styles.trackerError}>{errorMessage}</p> : null}
          {applicationRows.map((row, index) => (
            <div key={row.id}>
              <div className={styles.trackerRow}>
                <span className={styles.trackerColumnCheckbox}>
                  <input type="checkbox" className={styles.trackerRowCheckbox} aria-label={`Select ${row.company}`} />
                </span>
                <span className={styles.trackerRowText}>{row.company}</span>
                <span className={styles.trackerRowText}>{formatAppliedDate(row.date_applied)}</span>
                <span className={styles.trackerStatusCell}>
                  <button
                    type="button"
                    className={[styles.trackerStatusButton, getStatusButtonClassName(row.status)].join(" ")}
                    disabled={isUpdating(row.id)}
                    onClick={() => void updateApplicationStatus(row.id, getNextApplicationStatus(row.status))}
                  >
                    {row.status}
                  </button>
                </span>
                <span className={styles.trackerRowText}>{row.position}</span>
                <span className={styles.trackerRowText}>{row.location}</span>
                <span className={styles.trackerResumeCell}>
                  <span className={styles.trackerResumeChip}>
                    <span className={styles.trackerResumeName}>{row.resume_filename ?? "---"}</span>
                    <button
                      type="button"
                      className={styles.trackerResumeDownloadButton}
                      onClick={() => void downloadResume(row.id, row.resume_filename ?? "resume")}
                      disabled={!row.resume_path || Boolean(downloadingById[row.id])}
                      aria-label={`Download ${row.resume_filename ?? "resume"}`}
                    >
                      <img src={downloadIcon} alt="" aria-hidden="true" className={styles.trackerResumeDownloadIcon} />
                    </button>
                  </span>
                </span>
              </div>
              {index < applicationRows.length - 1 ? <div className={styles.trackerRowDivider} aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

const STUDIO_CONTENT_BY_VIEW: Record<Exclude<PickerView, "Application Tracker">, ComponentType> = {
  "Resume Studio": ResumeStudioView,
  "Career Path": () => <PlaceholderView title="Career Path" />,
  Resources: () => <PlaceholderView title="Resources" />,
};

type ApplicationTrackerContentProps = {
  selectedView: PickerView;
  selectedStatus: ApplicationTrackerStatus;
  onSelectStatus: (status: ApplicationTrackerStatus) => void;
};

export function ApplicationTrackerContent({
  selectedView,
  selectedStatus,
  onSelectStatus,
}: ApplicationTrackerContentProps) {
  if (selectedView === "Application Tracker") {
    return <ApplicationTrackerView selectedStatus={selectedStatus} onSelectStatus={onSelectStatus} />;
  }

  const SelectedView = STUDIO_CONTENT_BY_VIEW[selectedView];
  return <SelectedView />;
}
