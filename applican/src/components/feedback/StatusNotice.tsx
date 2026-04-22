import styles from "./StatusNotice.module.css";

type StatusNoticeTone = "info" | "success" | "warning" | "error";

type StatusNoticeProps = {
  tone: StatusNoticeTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  className?: string;
};

export default function StatusNotice({
  tone,
  message,
  actionLabel,
  onAction,
  actionDisabled = false,
  className = "",
}: StatusNoticeProps) {
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <div
      className={[styles.notice, styles[tone], className].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
      </div>
      {hasAction ? (
        <button type="button" className={styles.action} onClick={onAction} disabled={actionDisabled}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
