import { Children, useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { Flip } from "gsap/all";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, Flip);

type HorizontalScrollPanelsProps = {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  panelClassName?: string;
  scrub?: number;
  snap?: boolean;
  revealSelector?: string;
  snapIndices?: number[];
  scrollDistanceFactor?: number;
};

function directionalSnap(panelCount: number, snapIndices?: number[]) {
  const maxIndex = panelCount - 1;
  const allowedIndices = new Set(snapIndices?.filter((index) => index >= 0 && index <= maxIndex));
  // Always allow the first panel to avoid initial-load snapping into the second panel.
  allowedIndices.add(0);
  const snapPool =
    allowedIndices.size > 0
      ? Array.from(allowedIndices).sort((a, b) => a - b)
      : Array.from({ length: panelCount }, (_, index) => index);

  return (rawProgress: number, _scrollTrigger?: ScrollTrigger) => {
    if (maxIndex <= 0) {
      return rawProgress;
    }

    const rawIndex = rawProgress * maxIndex;
    const nearestIndex = snapPool.reduce((closest, candidate) =>
      Math.abs(candidate - rawIndex) < Math.abs(closest - rawIndex) ? candidate : closest,
    );
    return nearestIndex / maxIndex;
  };
}

export default function HorizontalScrollPanels({
  children,
  className,
  trackClassName,
  panelClassName,
  scrub = 0.1,
  snap = true,
  revealSelector,
  snapIndices,
  scrollDistanceFactor = 1,
}: HorizontalScrollPanelsProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const panels = Children.toArray(children);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;

    if (!scroller || !track) {
      return;
    }

    const ctx = gsap.context(() => {
      const panels = gsap.utils.toArray<HTMLElement>("[data-horizontal-scroll-panel]", track);
      if (panels.length <= 1) {
        return;
      }

      const animateReveal = (element: HTMLElement, isActive: boolean) => {
        gsap.killTweensOf(element);
        const state = Flip.getState(element, { props: "opacity" });

        gsap.set(element, {
          y: isActive ? 0 : 72,
          autoAlpha: isActive ? 1 : 0,
        });

        Flip.from(state, {
          duration: isActive ? 0.48 : 0.28,
          ease: isActive ? "power2.out" : "power2.in",
          simple: true,
          props: "opacity",
          absolute: false,
        });
      };

      gsap.set(track, {
        xPercent: 0,
        width: `${panels.length * 100}%`,
      });
      gsap.set(panels, {
        width: `${100 / panels.length}%`,
        flex: `0 0 ${100 / panels.length}%`,
      });

      const scrollTween = gsap.to(panels, {
        xPercent: -100 * (panels.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: track,
          scroller,
          pin: true,
          scrub,
          snap:
            snap && panels.length > 1
              ? {
                  snapTo: directionalSnap(panels.length, snapIndices),
                  duration: { min: 0.08, max: 0.18 },
                  delay: 0,
                  ease: "power3.out",
                }
              : undefined,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          end: () => `+=${scroller.clientWidth * (panels.length - 1) * scrollDistanceFactor}`,
        },
      });
      // Force deterministic first paint on panel 0 before any user interaction.
      scroller.scrollTop = 0;
      scrollTween.scrollTrigger?.scroll(0);
      scrollTween.scrollTrigger?.update();

      if (!revealSelector) {
        return;
      }

      const revealTargets = panels
        .map((panel) => panel.querySelector<HTMLElement>(revealSelector))
        .filter((target): target is HTMLElement => Boolean(target));

      gsap.set(revealTargets, {
        y: 72,
        autoAlpha: 0,
      });

      revealTargets.forEach((target) => {
        const panel = target.closest<HTMLElement>("[data-horizontal-scroll-panel]");
        if (!panel) {
          return;
        }

        ScrollTrigger.create({
          trigger: panel,
          containerAnimation: scrollTween,
          // Reveal only when the panel is fully in view so the previous card has fully exited.
          start: "left left",
          end: "right right",
          onEnter: () => animateReveal(target, true),
          onEnterBack: () => animateReveal(target, true),
        });
      });
    }, scroller);

    return () => {
      ctx.revert();
      scroller.scrollTop = 0;
    };
  }, [panels.length, scrub, snap, revealSelector, snapIndices, scrollDistanceFactor]);

  return (
    <div ref={scrollerRef} className={className}>
      <div ref={trackRef} className={trackClassName}>
        {panels.map((child, index) => (
          <div key={index} className={panelClassName} data-horizontal-scroll-panel>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
