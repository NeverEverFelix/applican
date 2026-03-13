import type { HistoryCardData } from "./history";
import styles from "./history.module.css";

type HistorySummaryPanelProps = {
  data: HistoryCardData;
};

export default function HistorySummaryPanel({ data }: HistorySummaryPanelProps) {
  return (
    <article
      className={styles.summaryPanel}
      data-history-summary-reveal
      aria-label={`Analysis summary for ${data.role} at ${data.company}`}
    >
      <div className={styles.summaryEyebrow}>Analysis Summary</div>
      <h2 className={styles.summaryTitle}>{data.role}</h2>
      <p className={styles.summaryMeta}>{`${data.company} - ${data.location}`}</p>
      <div className={styles.summaryBody}>
        <p className={styles.summaryText}>{data.analysisSummary}</p>
      </div>
    </article>
  );
}
