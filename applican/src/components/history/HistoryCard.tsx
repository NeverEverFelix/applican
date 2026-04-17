import styles from "./HistoryCard.module.css";
import { historyCardSeed, type HistoryCardData } from "./history";
import applicanCreamIcon from "../../assets/resume-icons/applican-cream-resume-icon.svg";
import clockIcon from "../../assets/clock.svg";

type HistoryCardProps = {
  data?: HistoryCardData;
  onResumeIconClick?: (data: HistoryCardData) => void;
  isResumeIconDisabled?: boolean;
  showSummary?: boolean;
};

export default function HistoryCard({
  data = historyCardSeed,
  onResumeIconClick,
  isResumeIconDisabled = false,
  showSummary = true,
}: HistoryCardProps) {
  const { role, company, location, industry, score, experienceNeeded, jobType, createdAt, appliedAt, analysisSummary } =
    data;
  const titleDisplay = `${company} - ${role}`;
  const locationDisplay =
    location.trim().toLowerCase() === "unknown location" || location.trim() === "" ? "Location: N/A" : location;
  const isIconClickable = Boolean(onResumeIconClick);

  return (
    <article
      className={styles.card}
      data-history-entry-id={data.historyEntryId}
      data-history-panel="card"
      aria-label={`History card for ${role} at ${company}`}
    >
      <div className={styles.headerRow}>
        <button
          type="button"
          className={[styles.iconContainer, isIconClickable ? styles.iconButton : ""].join(" ").trim()}
          onClick={() => onResumeIconClick?.(data)}
          disabled={!isIconClickable || isResumeIconDisabled}
          aria-label={`Open resume used for ${role} at ${company}`}
        >
          <img src={applicanCreamIcon} alt="" className={styles.icon} />
        </button>

        <div className={styles.titleLocationContainer}>
          <p className={styles.titleText}>{titleDisplay}</p>
          <p className={styles.locationText}>{locationDisplay}</p>
        </div>
      </div>

      <div className={styles.contentStack}>
        <div className={styles.infoPillsContainer}>
          <div className={styles.pillRowTop}>
            <span className={[styles.infoPill, styles.resumeScorePill].join(" ")}>{`${score}% Match`}</span>
            <span className={[styles.infoPill, styles.analysisSubmittedPill].join(" ")}>{`Date: ${createdAt}`}</span>
            <span className={[styles.infoPill, styles.yearsExperiencePill].join(" ")}>{`Experience: ${experienceNeeded}`}</span>
          </div>

          <div className={styles.pillRowBottom}>
            <span className={[styles.infoPill, styles.industryPill].join(" ")}>{`Industry: ${industry}`}</span>
            <span className={[styles.infoPill, styles.jobStatusPill].join(" ")}>{`Job Type: ${jobType}`}</span>
            <span className={[styles.infoPill, styles.appliedDatePill].join(" ")}>
              <span className={styles.appliedDateContent}>
                <img src={clockIcon} alt="" className={styles.appliedDateIcon} />
                <span>{`Applied: ${appliedAt}`}</span>
              </span>
            </span>
          </div>
        </div>
        {showSummary ? (
          <div className={styles.analysisContainer}>
            <p className={styles.analysisText}>{analysisSummary}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
