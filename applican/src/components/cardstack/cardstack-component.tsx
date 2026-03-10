import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { Flip } from "gsap/all";
import styles from "./cardstack.module.css";
import resumeOptimizationTemplate from "../../assets/resume-optimization.svg?raw";

type Optimization = {
  experience_title: string;
  role_before: string;
  role_after: string;
  bullets: Array<{
    original: string;
    rewritten: string;
    action: "replace" | "add";
    reason: string;
  }>;
};

type CardStackProps = {
  optimizations: Optimization[];
};

type CardModel = {
  action: string;
  title: string;
  before: string;
  after: string;
  reason: string;
};

gsap.registerPlugin(Flip);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalize(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Not available";
}

function getFittedFontSize(value: string): number {
  const length = value.trim().length;

  if (length > 260) return 11;
  if (length > 220) return 12;
  if (length > 180) return 13;
  if (length > 145) return 14;
  if (length > 110) return 15;
  if (length > 85) return 16;
  return 17;
}

function buildCardSvg(card: CardModel): string {
  const beforeFontSize = getFittedFontSize(card.before);
  const afterFontSize = getFittedFontSize(card.after);

  return resumeOptimizationTemplate
    .replaceAll("__ACTION__", escapeXml(card.action))
    .replaceAll("__TITLE__", escapeXml(card.title))
    .replaceAll("__BEFORE_TEXT__", escapeXml(card.before))
    .replaceAll("__AFTER_TEXT__", escapeXml(card.after))
    .replaceAll("__REASON_TEXT__", escapeXml(card.reason))
    .replaceAll("__BEFORE_FONT_SIZE__", String(beforeFontSize))
    .replaceAll("__AFTER_FONT_SIZE__", String(afterFontSize));
}

function buildCards(optimizations: Optimization[]): CardModel[] {
  const cards: CardModel[] = [];

  optimizations.forEach((optimization) => {
    optimization.bullets.forEach((bullet) => {
      cards.push({
        action: bullet.action.toUpperCase(),
        title: normalize(optimization.experience_title || optimization.role_after || optimization.role_before),
        before: normalize(bullet.original),
        after: normalize(bullet.rewritten),
        reason: normalize(bullet.reason),
      });
    });
  });

  return cards;
}

export function CardStack({ optimizations }: CardStackProps) {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const isAnimatingRef = useRef(false);
  const cards = useMemo(() => buildCards(optimizations), [optimizations]);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider || cards.length < 2) {
      return;
    }
    const sliderElement = slider;

    function moveCard() {
      const lastItem = sliderElement.querySelector(".item:last-child") as HTMLElement | null;

      if (lastItem) {
        lastItem.style.display = "none";
        const newItem = lastItem.cloneNode(true) as HTMLElement;
        newItem.style.removeProperty("display");
        sliderElement.insertBefore(newItem, sliderElement.firstChild);
      }
    }

    const handleCycle = () => {
      if (isAnimatingRef.current) {
        return;
      }

      const targets = sliderElement.querySelectorAll(".item");
      if (targets.length < 2) {
        return;
      }

      isAnimatingRef.current = true;
      const state = Flip.getState(targets);

      moveCard();

      Flip.from(state, {
        targets: sliderElement.querySelectorAll(".item"),
        ease: "sine.inOut",
        absolute: true,
        onEnter: (elements) => {
          return gsap.from(elements, {
            duration: 0.3,
            yPercent: 20,
            opacity: 0,
            ease: "expo.out",
          });
        },
        onLeave: (elements) => {
          return gsap.to(elements, {
            duration: 0.3,
            yPercent: 5,
            xPercent: -5,
            transformOrigin: "bottom left",
            opacity: 0,
            ease: "expo.out",
            onComplete() {
              const leaving = Array.isArray(elements) ? elements[0] : elements;
              if (leaving && sliderElement.contains(leaving as Node)) {
                sliderElement.removeChild(leaving as Node);
              }
              isAnimatingRef.current = false;
            },
          });
        },
      });
    };

    sliderElement.addEventListener("click", handleCycle);
    return () => {
      sliderElement.removeEventListener("click", handleCycle);
    };
  }, [cards.length]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div ref={sliderRef} className={`${styles.stack} slider`} aria-label="Cycle resume optimization cards">
      {cards.map((card, index) => {
        const svgMarkup = buildCardSvg(card);

        return (
          <article key={`${card.title}-${index}`} className={`${styles.card} item`} data-card-item>
            <div
              className={styles.cardSvg}
              role="img"
              aria-label={`${card.action} optimization for ${card.title}`}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </article>
        );
      })}
    </div>
  );
}
