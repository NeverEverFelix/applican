import styles from "./HistoryCard.module.css";
import { historyCardSeed, type HistoryCardData } from "./history";
import applicanCreamIcon from "../../assets/resume-icons/applican-cream-resume-icon.svg";

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
  const { role, company, location, score, experienceNeeded, jobType, createdAt, analysisSummary } = data;
  const locationDisplay = `${company} - ${location}`;
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
          <p className={styles.titleText}>{role}</p>
          <p className={styles.locationText}>{locationDisplay}</p>
        </div>
      </div>

      <div className={styles.contentStack}>
        <div className={styles.infoPillsContainer}>
          <div className={styles.pillRowTop}>
            <span className={[styles.infoPill, styles.resumeScorePill].join(" ")}>{`Resume Score: ${score}`}</span>
            <span className={[styles.infoPill, styles.analysisSubmittedPill].join(" ")}>{`Date: ${createdAt}`}</span>
            <span className={[styles.infoPill, styles.yearsExperiencePill].join(" ")}>{`Experience: ${experienceNeeded}`}</span>
          </div>

          <div className={styles.pillRowBottom}>
            <span className={[styles.infoPill, styles.jobStatusPill].join(" ")}>{`Job Type: ${jobType}`}</span>
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
