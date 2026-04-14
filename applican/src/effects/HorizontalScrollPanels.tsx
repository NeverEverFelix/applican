import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type HorizontalScrollPanelsProps = {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  panelClassName?: string;
  revealSelector?: string;
  scrub?: number;
  scrollDistanceFactor?: number;
};

export default function HorizontalScrollPanels({
  children,
  className,
  trackClassName,
  panelClassName,
  scrub = 1,
  scrollDistanceFactor = 1,
}: HorizontalScrollPanelsProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    const panel = panelRef.current;

    if (!scroller || !stage || !panel) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(panel, { xPercent: 8 });

      gsap.to(panel, {
        xPercent: -8,
        ease: "none",
        scrollTrigger: {
          trigger: stage,
          scroller,
          pin: true,
          scrub,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          end: () => `+=${1600 * scrollDistanceFactor}`,
        },
      });
    }, scroller);

    return () => {
      ctx.revert();
    };
  }, [scrub, scrollDistanceFactor]);

  return (
    <div ref={scrollerRef} className={className}>
      <div ref={stageRef} className={trackClassName}>
        <div ref={panelRef} className={panelClassName}>
          {children}
        </div>
      </div>
    </div>
  );
}
