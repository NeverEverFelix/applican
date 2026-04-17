import * as Sentry from "@sentry/react";
import { type ComponentType, type UIEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { EditorView } from "./views/EditorView";
import downloadIcon from "../../../assets/Download Icon.png";
import HistoryCard from "../../../components/history/HistoryCard";
import HistorySummaryPanel from "../../../components/history/HistorySummaryPanel";
import type { HistoryCardData } from "../../../components/history/history";
import { listHistoryCards } from "../../../features/history/api/listHistoryCards";
import FadeSwipePanels from "../../../effects/FadeSwipePanels";
import Profile from "../../../components/profile/Profile";

export type ApplicationTrackerStatus = ApplicationFilter;

function PlaceholderView({ title }: { title: string }) {
  return (
    <section className={styles.placeholderPanel}>
      <h2 className={styles.placeholderTitle}>{title}</h2>
      <p className={styles.placeholderCopy}>This view will be built inside the studio container.</p>
    </section>
  );
}

function CareerPathView() {
  return (
    <section className={styles.careerPathView}>
      <div className={styles.careerPathComingSoonOverlay} role="status" aria-live="polite">
        <p className={styles.careerPathComingSoonText}>Coming soon</p>
      </div>
    </section>
  );
}

function HistoryView() {
  const historyLimit = 10;
  const [historyCards, setHistoryCards] = useState<HistoryCardData[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [historyResumeError, setHistoryResumeError] = useState<string | null>(null);
  const [openingResumeByApplicationId, setOpeningResumeByApplicationId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isCancelled = false;

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryLoadError(null);
      try {
        const { cards } = await listHistoryCards(historyLimit, 0);
        if (!isCancelled) {
          setHistoryCards(cards);
        }
      } catch (error) {
        if (!isCancelled) {
          const message = error instanceof Error ? error.message : "Failed to load history.";
          setHistoryLoadError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    void loadHistory();
    return () => {
      isCancelled = true;
    };
  }, [historyLimit]);

  if (isHistoryLoading) {
    return (
      <section className={styles.historyView}>
        <p className={styles.historyStatusMessage}>Loading history...</p>
      </section>
    );
  }

  if (historyLoadError) {
    return (
      <section className={styles.historyView}>
        <p className={styles.historyStatusMessage}>{historyLoadError}</p>
      </section>
    );
  }

  if (historyCards.length === 0) {
    return (
      <section className={styles.historyView}>
        <p className={styles.historyStatusMessage}>No previous analyses yet.</p>
      </section>
    );
  }
  const openHistoryResume = async (card: HistoryCardData) => {
    const applicationId = card.sourceApplicationId?.trim() ?? "";
    if (!applicationId) {
      setHistoryResumeError("Resume file unavailable for this history item.");
      return;
    }

    setHistoryResumeError(null);
    setOpeningResumeByApplicationId((prev) => ({ ...prev, [applicationId]: true }));
    try {
      const data = await getResumeDownloadUrl(applicationId);
      window.open(data.signed_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open resume.";
      setHistoryResumeError(message);
    } finally {
      setOpeningResumeByApplicationId((prev) => ({ ...prev, [applicationId]: false }));
    }
  };

  const historyPanels = historyCards.flatMap((card, index) => {
    const panelBaseKey =
      card.historyEntryId || `${card.sourceApplicationId ?? card.submittedAtIso ?? card.createdAt}-${index}`;

    return [
      (
        <div
          key={`${panelBaseKey}-card`}
          className={styles.historySequence}
          data-history-entry-id={card.historyEntryId}
          data-history-panel="card"
        >
          <div className={styles.historySingleCardWrap}>
            <HistoryCard
              data={card}
              onResumeIconClick={openHistoryResume}
              isResumeIconDisabled={
                !card.sourceApplicationId ||
                Boolean(card.sourceApplicationId && openingResumeByApplicationId[card.sourceApplicationId])
              }
              showSummary={false}
            />
          </div>
        </div>
      ),
      (
        <div
          key={`${panelBaseKey}-summary`}
          className={styles.historySequence}
          data-history-entry-id={card.historyEntryId}
          data-history-panel="summary"
        >
          <div className={styles.historySingleCardWrap}>
            <HistorySummaryPanel data={card} />
          </div>
        </div>
      ),
    ];
  });

  return (
    <section className={styles.historyView}>
      {historyResumeError ? <p className={styles.historyInlineError}>{historyResumeError}</p> : null}
      <div className={styles.historyFlow}>
        <FadeSwipePanels
          className={styles.historyScrollArea}
          stageClassName={styles.historyFadeStage}
          layerClassName={styles.historyFadeLayer}
          items={historyPanels}
        />
      </div>
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
  const { applications, counts, isLoading, isFetchingMore, hasMore, errorMessage, retryLoad, loadMore, updateApplicationStatus, isUpdating } =
    useApplications();
  const [downloadingById, setDownloadingById] = useState<Record<string, boolean>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showTrailingLoadState, setShowTrailingLoadState] = useState(false);
  const wasFetchingMoreRef = useRef(false);
  const trailingLoadTimeoutRef = useRef<number | null>(null);
  const skeletonRows = 6;
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
    setDownloadError(null);
    try {
      const data = await getResumeDownloadUrl(applicationId);
      const response = await fetch(data.signed_url);
      if (!response.ok) {
        throw new Error(`Download request failed with status ${response.status}.`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = data.filename || fallbackFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: "application_tracker", action: "download_resume" },
        extra: { applicationId },
      });
      const message = error instanceof Error ? error.message : "Could not download resume.";
      setDownloadError(message);
    } finally {
      setDownloadingById((prev) => ({ ...prev, [applicationId]: false }));
    }
  };

  const onGridScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isLoading || isFetchingMore || !hasMore) {
      return;
    }

    const target = event.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom <= 120) {
      loadMore();
    }
  };

  useEffect(() => {
    if (isFetchingMore) {
      wasFetchingMoreRef.current = true;
      return;
    }

    if (wasFetchingMoreRef.current && !hasMore) {
      setShowTrailingLoadState(true);
      if (trailingLoadTimeoutRef.current !== null) {
        window.clearTimeout(trailingLoadTimeoutRef.current);
      }
      trailingLoadTimeoutRef.current = window.setTimeout(() => {
        setShowTrailingLoadState(false);
        trailingLoadTimeoutRef.current = null;
      }, 900);
    }

    wasFetchingMoreRef.current = false;
  }, [hasMore, isFetchingMore]);

  useEffect(() => {
    return () => {
      if (trailingLoadTimeoutRef.current !== null) {
        window.clearTimeout(trailingLoadTimeoutRef.current);
      }
    };
  }, []);

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
        <div className={styles.trackerGridBody} onScroll={onGridScroll}>
          {errorMessage ? (
            <div className={styles.trackerErrorPanel}>
              <p className={styles.trackerError}>{errorMessage}</p>
              <button type="button" className={styles.trackerRetryButton} onClick={retryLoad}>
                Retry
              </button>
            </div>
          ) : null}
          {downloadError ? <p className={styles.trackerError}>{downloadError}</p> : null}
          {isLoading
            ? Array.from({ length: skeletonRows }).map((_, index) => (
                <div key={`skeleton-${index}`}>
                  <div className={styles.trackerRow}>
                    <span className={styles.trackerColumnCheckbox}>
                      <span className={[styles.trackerSkeleton, styles.trackerSkeletonCheckbox].join(" ")} />
                    </span>
                    <span className={[styles.trackerSkeleton, styles.trackerSkeletonTextLong].join(" ")} />
                    <span className={[styles.trackerSkeleton, styles.trackerSkeletonTextMedium].join(" ")} />
                    <span className={[styles.trackerSkeleton, styles.trackerSkeletonStatus].join(" ")} />
                    <span className={[styles.trackerSkeleton, styles.trackerSkeletonTextLong].join(" ")} />
                    <span className={[styles.trackerSkeleton, styles.trackerSkeletonTextMedium].join(" ")} />
                    <span className={[styles.trackerSkeleton, styles.trackerSkeletonResume].join(" ")} />
                  </div>
                  <div className={styles.trackerRowDivider} aria-hidden="true" />
                </div>
              ))
            : null}
          {!isLoading && !errorMessage && applicationRows.length === 0 ? (
            <p className={styles.trackerEmptyMessage}>No applications yet for this filter.</p>
          ) : null}
          {!isLoading && !errorMessage
            ? applicationRows.map((row) => (
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
                  <div className={styles.trackerRowDivider} aria-hidden="true" />
                </div>
              ))
            : null}
          {!isLoading && (isFetchingMore || showTrailingLoadState) ? (
            <p className={styles.trackerLoadState}>Loading more applications...</p>
          ) : null}
        </div>
      </section>
    </section>
  );
}

const STUDIO_CONTENT_BY_VIEW: Record<Exclude<PickerView, "Application Tracker" | "Profile">, ComponentType> = {
  "Resume Studio": ResumeStudioView,
  History: HistoryView,
  "Career Path": CareerPathView,
  Editor: EditorView,
  Resources: () => <PlaceholderView title="Resources" />,
};

type ApplicationTrackerContentProps = {
  selectedView: PickerView;
  selectedStatus: ApplicationTrackerStatus;
  onSelectStatus: (status: ApplicationTrackerStatus) => void;
  onSelectView: (view: PickerView) => void;
};

export function ApplicationTrackerContent({
  selectedView,
  selectedStatus,
  onSelectStatus,
  onSelectView,
}: ApplicationTrackerContentProps) {
  if (selectedView === "Application Tracker") {
    return <ApplicationTrackerView selectedStatus={selectedStatus} onSelectStatus={onSelectStatus} />;
  }

  if (selectedView === "Profile") {
    return <Profile onClose={() => onSelectView("Resume Studio")} />;
  }

  const SelectedView = STUDIO_CONTENT_BY_VIEW[selectedView];
  return <SelectedView />;
}
