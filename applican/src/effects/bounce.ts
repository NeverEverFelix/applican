import gsap from "gsap";

type BounceOptions = {
  shadowTarget?: Element | null;
  duration?: number;
  travelPercent?: number;
};

export function applyBounceEffect(target: Element, options?: BounceOptions): () => void {
  const duration = options?.duration ?? 1.15;
  const travelPercent = -Math.abs(options?.travelPercent ?? 120);
  const reboundPercent = Math.round(travelPercent * 0.35);

  gsap.set(target, {
    transformOrigin: "center bottom",
    force3D: true,
    scaleX: 1,
    scaleY: 1,
  });

  const iconTween = gsap.to(target, {
    keyframes: {
      "0%": { yPercent: 0, scaleX: 1, scaleY: 1 },
      "12%": { yPercent: reboundPercent, scaleX: 1, scaleY: 1, ease: "sine.in" },
      "48%": { yPercent: travelPercent, scaleX: 1, scaleY: 1, ease: "sine.out" },
      "72%": { yPercent: reboundPercent * 0.28, scaleX: 1, scaleY: 1, ease: "sine.in" },
      "100%": { yPercent: 0, scaleX: 1, scaleY: 1 },
      easeEach: "sine.out",
    },
    duration,
    repeat: -1,
  });

  let shadowTween: gsap.core.Tween | null = null;
  if (options?.shadowTarget) {
    gsap.set(options.shadowTarget, { transformOrigin: "center", force3D: true });
    shadowTween = gsap.to(options.shadowTarget, {
      scale: 0.82,
      opacity: 0.16,
      duration: duration / 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }

  return () => {
    iconTween.kill();
    shadowTween?.kill();
    gsap.set(target, { clearProps: "transform" });
    if (options?.shadowTarget) {
      gsap.set(options.shadowTarget, { clearProps: "transform,opacity" });
    }
  };
}
