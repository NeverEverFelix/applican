import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type ApplicanLoadingBarProps = {
  progress?: number; // 0-100
  width?: number;
  height?: number;
  showPercent?: boolean;
};

export default function ApplicanLoadingBar({
  progress = 64,
  width = 420,
  height = 12,
  showPercent = false,
}: ApplicanLoadingBarProps) {
  const fillRef = useRef<HTMLDivElement | null>(null);
  const percentRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, progress));

    gsap.to(fillRef.current, {
      width: `${clamped}%`,
      duration: 0.7,
      ease: "power2.out",
    });

    if (showPercent && percentRef.current) {
      const state = { value: 0 };
      const current = Number(percentRef.current.dataset.value || 0);
      state.value = current;

      gsap.to(state, {
        value: clamped,
        duration: 0.7,
        ease: "power2.out",
        onUpdate: () => {
          if (!percentRef.current) return;
          const rounded = Math.round(state.value);
          percentRef.current.textContent = `${rounded}%`;
          percentRef.current.dataset.value = String(rounded);
        },
      });
    }
  }, [progress, showPercent]);

  return (
    <div
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          width: "100%",
          height,
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 999,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          ref={fillRef}
          style={{
            width: "0%",
            height: "100%",
            borderRadius: 999,
            background:
              "linear-gradient(90deg, #1a73e8 0%, #2f8cff 55%, #63a4ff 100%)",
            boxShadow: "0 0 16px rgba(26,115,232,0.28)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)",
          }}
        />
      </div>

      {showPercent && (
        <span
          ref={percentRef}
          data-value="0"
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.65)",
            fontFamily: "Inter, sans-serif",
            textAlign: "right",
          }}
        >
          0%
        </span>
      )}
    </div>
  );
}