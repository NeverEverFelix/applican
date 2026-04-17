import { useEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./applicationTrack.module.css";
import { getStudioContainerVariant, type PickerView } from "./studioContainerView";
import type { ApplicationTrackerStatus } from "./applicationTrackerContent";
import { ApplicationTrackerContent } from "./applicationTrackerContent";

type ApplicationTrackerProps = {
  selectedView: PickerView;
  onSelectView: (view: PickerView) => void;
};

export default function ApplicationTracker({ selectedView, onSelectView }: ApplicationTrackerProps) {
  const studioVariant = getStudioContainerVariant(selectedView);
  const [selectedStatus, setSelectedStatus] = useState<ApplicationTrackerStatus>("all");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (studioVariant !== "careerPath" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rawOffsetX = (x - rect.width / 2) * 0.008;
    const rawOffsetY = (y - rect.height / 2) * 0.008;
    const offsetX = Math.max(-4, Math.min(4, rawOffsetX));
    const offsetY = Math.max(-4, Math.min(4, rawOffsetY));

    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      containerRef.current.style.setProperty("--pointer-x", `${x}px`);
      containerRef.current.style.setProperty("--pointer-y", `${y}px`);
      containerRef.current.style.setProperty("--dot-offset-x", `${offsetX}px`);
      containerRef.current.style.setProperty("--dot-offset-y", `${offsetY}px`);
      rafRef.current = null;
    });
  };

  const onMouseLeave = () => {
    if (studioVariant !== "careerPath" || !containerRef.current) return;
    containerRef.current.style.setProperty("--pointer-x", "50%");
    containerRef.current.style.setProperty("--pointer-y", "35%");
    containerRef.current.style.setProperty("--dot-offset-x", "0px");
    containerRef.current.style.setProperty("--dot-offset-y", "0px");
  };

  return (
    <div
      ref={containerRef}
      className={[styles.studioContainer, styles[studioVariant]].join(" ")}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <ApplicationTrackerContent
        selectedView={selectedView}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        onSelectView={onSelectView}
      />
    </div>
  );
}
