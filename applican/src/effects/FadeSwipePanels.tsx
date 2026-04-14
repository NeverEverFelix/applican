import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { Observer } from "gsap/all";
import arrowIcon from "../assets/arrow.svg";

gsap.registerPlugin(Observer);

type FadeSwipePanelsProps = {
  items: ReactNode[];
  className?: string;
  stageClassName?: string;
  layerClassName?: string;
};

export default function FadeSwipePanels({
  items,
  className,
  stageClassName,
  layerClassName,
}: FadeSwipePanelsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const arrowRef = useRef<HTMLImageElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const panels = panelRefs.current.filter((panel): panel is HTMLDivElement => Boolean(panel));
    const arrow = arrowRef.current;

    if (!container || !arrow || panels.length === 0) {
      return;
    }

    let observer: Observer | null = null;
    let releaseDelay: gsap.core.Tween | null = null;
    let safetyUnlock: gsap.core.Tween | null = null;

    const ctx = gsap.context(() => {
      let currentIndex = 0;
      let isAnimating = false;
      let isGestureLocked = false;
      let lockedDirection: 1 | -1 | 0 = 0;

      gsap.set(panels, {
        autoAlpha: 0,
        yPercent: 4,
        scale: 1.015,
        pointerEvents: "none",
      });
      gsap.set(panels[0], {
        autoAlpha: 1,
        yPercent: 0,
        scale: 1,
        pointerEvents: "auto",
      });
      gsap.set(arrow, {
        autoAlpha: 0,
        scale: 0.92,
        xPercent: -50,
        yPercent: -50,
        pointerEvents: "none",
        transformOrigin: "50% 50%",
      });

      const flashArrow = (panel: HTMLDivElement, direction: 1 | -1) => {
        const containerRect = container.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const x = direction === 1 ? panelRect.right - containerRect.left + 50 : panelRect.left - containerRect.left - 50;
        const y = panelRect.top - containerRect.top + panelRect.height / 2;

        gsap.killTweensOf(arrow);
        gsap.set(arrow, {
          left: x,
          top: y,
          rotate: direction === 1 ? 0 : 180,
        });

        gsap.timeline()
          .to(arrow, {
            autoAlpha: 1,
            scale: 1,
            duration: 0.16,
            ease: "power2.out",
          })
          .to(arrow, {
            autoAlpha: 0,
            scale: 1.06,
            duration: 0.22,
            ease: "power2.in",
          });
      };

      const gotoPanel = (nextIndex: number) => {
        if (isAnimating || nextIndex === currentIndex || nextIndex < 0 || nextIndex >= panels.length) {
          return false;
        }

        const currentPanel = panels[currentIndex];
        const nextPanel = panels[nextIndex];

        isAnimating = true;
        gsap.set(currentPanel, { pointerEvents: "none" });
        gsap.set(nextPanel, { pointerEvents: "auto" });
        flashArrow(currentPanel, nextIndex > currentIndex ? 1 : -1);

        gsap.timeline({
          defaults: { duration: 0.42, ease: "power2.out" },
          onComplete: () => {
            currentIndex = nextIndex;
            isAnimating = false;
          },
        })
          .to(
            currentPanel,
            {
              autoAlpha: 0,
              yPercent: -4,
              scale: 0.985,
            },
            0
          )
          .fromTo(
            nextPanel,
            {
              autoAlpha: 0,
              yPercent: 4,
              scale: 1.015,
            },
            {
              autoAlpha: 1,
              yPercent: 0,
              scale: 1,
            },
            0
          );

        return true;
      };

      const unlockGesture = () => {
        isGestureLocked = false;
        lockedDirection = 0;
        releaseDelay?.kill();
        releaseDelay = null;
        safetyUnlock?.kill();
        safetyUnlock = null;
      };

      const handleStep = (direction: 1 | -1) => {
        if (isAnimating) {
          return;
        }

        if (isGestureLocked) {
          return;
        }

        isGestureLocked = true;
        lockedDirection = direction;
        safetyUnlock?.kill();
        safetyUnlock = gsap.delayedCall(1.2, unlockGesture);
        if (!gotoPanel(currentIndex + direction)) {
          unlockGesture();
        }
      };

      observer = Observer.create({
        target: container,
        type: "wheel,touch",
        wheelSpeed: -1,
        tolerance: 24,
        dragMinimum: 24,
        preventDefault: true,
        onStop: () => {
          if (!isGestureLocked) {
            return;
          }

          releaseDelay?.kill();
          releaseDelay = gsap.delayedCall(0.12, unlockGesture);
        },
        onUp: () => {
          if (lockedDirection === -1) {
            return;
          }
          handleStep(1);
        },
        onDown: () => {
          if (lockedDirection === 1) {
            return;
          }
          handleStep(-1);
        },
        onRight: () => {
          if (lockedDirection === -1) {
            return;
          }
          handleStep(1);
        },
        onLeft: () => {
          if (lockedDirection === 1) {
            return;
          }
          handleStep(-1);
        },
      });
    }, container);

    return () => {
      releaseDelay?.kill();
      safetyUnlock?.kill();
      observer?.kill();
      ctx.revert();
    };
  }, [items]);

  return (
    <div ref={containerRef} className={className}>
      <div className={stageClassName}>
        {items.map((item, index) => (
          <div
            key={index}
            ref={(node) => {
              panelRefs.current[index] = node;
            }}
            className={layerClassName}
          >
            {item}
          </div>
        ))}
        <img
          ref={arrowRef}
          src={arrowIcon}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 38,
            height: 39,
            zIndex: 3,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
