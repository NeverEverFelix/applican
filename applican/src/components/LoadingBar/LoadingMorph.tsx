import { useMemo, type CSSProperties } from "react";
import styles from "./LoadingMorph.module.css";

type LoadingMorphProps = {
  progress?: number;
  className?: string;
};

function buildDigits(progress: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  if (clamped === 100) {
    return {
      hundreds: 1,
      tens: 0,
      ones: 0,
    };
  }

  return {
    hundreds: null,
    tens: clamped >= 10 ? Math.floor(clamped / 10) : null,
    ones: clamped % 10,
  };
}

function DigitSlot({ digit }: { digit: number | null }) {
  const rows = useMemo(() => ["", ...Array.from({ length: 10 }, (_, index) => String(index))], []);
  const index = digit === null ? 0 : digit + 1;

  return (
    <div className={styles.slot} aria-hidden="true">
      <div
        className={styles.track}
        style={{ "--digit-index": index } as CSSProperties}
      >
        {rows.map((value, rowIndex) => (
          <span key={`${value}-${rowIndex}`} className={styles.digit}>
            {value === "" ? "\u00A0" : value}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LoadingMorph({ progress = 0, className = "" }: LoadingMorphProps) {
  const digits = buildDigits(progress);

  return (
    <div
      className={[styles.morph, className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-label={`Progress ${Math.round(progress)} percent`}
    >
      <DigitSlot digit={digits.hundreds} />
      <DigitSlot digit={digits.tens} />
      <DigitSlot digit={digits.ones} />
      <span className={styles.suffix}>%</span>
    </div>
  );
}
