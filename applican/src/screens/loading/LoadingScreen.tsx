import { useEffect, useRef, useState, type CSSProperties } from "react";
import applicanLogo from "../../assets/applican.svg";
import LoadingMorph from "../../components/LoadingBar/LoadingMorph.tsx";
import { animateWords } from "../../effects/splittext";
import { gsap } from "gsap";
import styles from "./LoadingScreen.module.css";
import {
  buildResumeProjectile,
  INTRO_MESSAGE,
  INTRO_MESSAGE_MS,
  JOB_MARKET_QUOTES,
  MAX_PROJECTILE_DURATION_MS,
  QUOTE_ROTATE_MS,
  type ResumeProjectile,
} from "./LoadingScreen";

const SPAWN_INTERVAL_MS = 240;
const MAX_PROJECTILES = 18;
const MORPH_REVEAL_DELAY_MS = 1400;

type LoadingScreenProps = {
  backendProgress?: number;
  animationOriginMs?: number;
};

type ActiveResumeProjectile = ResumeProjectile & {
  elapsedMs: number;
};

export default function LoadingScreen({ backendProgress = 0, animationOriginMs }: LoadingScreenProps) {
  const getElapsedMs = () => {
    if (!animationOriginMs) {
      return 0;
    }

    return Math.max(0, Date.now() - animationOriginMs);
  };
  const [projectiles, setProjectiles] = useState<ActiveResumeProjectile[]>(() => {
    const elapsedMs = getElapsedMs();
    if (elapsedMs <= 0) {
      return [];
    }

    const firstVisibleSpawnMs = Math.max(0, elapsedMs - MAX_PROJECTILE_DURATION_MS);
    const firstVisibleSequence = Math.floor(firstVisibleSpawnMs / SPAWN_INTERVAL_MS);
    const lastVisibleSequence = Math.floor(elapsedMs / SPAWN_INTERVAL_MS);
    const restoredProjectiles: ActiveResumeProjectile[] = [];

    for (let sequence = firstVisibleSequence; sequence <= lastVisibleSequence; sequence += 1) {
      const projectile = buildResumeProjectile(sequence + 1);
      const spawnedAtMs = sequence * SPAWN_INTERVAL_MS;
      restoredProjectiles.push({
        ...projectile,
        elapsedMs: Math.max(0, elapsedMs - spawnedAtMs),
      });
    }

    return restoredProjectiles.slice(-MAX_PROJECTILES);
  });
  const [showIntroMessage, setShowIntroMessage] = useState(() => getElapsedMs() < INTRO_MESSAGE_MS);
  const [shouldRevealMorph, setShouldRevealMorph] = useState(() => getElapsedMs() >= INTRO_MESSAGE_MS + MORPH_REVEAL_DELAY_MS);
  const [quoteIndex, setQuoteIndex] = useState(() => {
    const elapsedAfterIntroMs = Math.max(0, getElapsedMs() - INTRO_MESSAGE_MS);
    if (elapsedAfterIntroMs <= 0 || JOB_MARKET_QUOTES.length === 0) {
      return 0;
    }

    return Math.floor(elapsedAfterIntroMs / QUOTE_ROTATE_MS) % JOB_MARKET_QUOTES.length;
  });
  const nextId = useRef(Math.floor(getElapsedMs() / SPAWN_INTERVAL_MS) + 2);
  const quoteRef = useRef<HTMLParagraphElement | null>(null);
  const morphRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProjectiles((prev) => {
        const next = [...prev, { ...buildResumeProjectile(nextId.current), elapsedMs: 0 }];
        nextId.current += 1;
        return next.slice(-MAX_PROJECTILES);
      });
    }, SPAWN_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!showIntroMessage) {
      return;
    }

    const remainingIntroMs = Math.max(0, INTRO_MESSAGE_MS - getElapsedMs());
    const timeoutId = window.setTimeout(() => {
      setShowIntroMessage(false);
    }, remainingIntroMs);

    return () => window.clearTimeout(timeoutId);
  }, [showIntroMessage]);

  useEffect(() => {
    if (showIntroMessage || JOB_MARKET_QUOTES.length <= 1) {
      return;
    }

    const elapsedAfterIntroMs = Math.max(0, getElapsedMs() - INTRO_MESSAGE_MS);
    const elapsedIntoCurrentQuoteMs = elapsedAfterIntroMs % QUOTE_ROTATE_MS;
    const msUntilNextQuote = elapsedIntoCurrentQuoteMs === 0 ? QUOTE_ROTATE_MS : QUOTE_ROTATE_MS - elapsedIntoCurrentQuoteMs;
    let intervalId: number | null = null;

    const timeoutId = window.setTimeout(() => {
      setQuoteIndex((prev) => (prev + 1) % JOB_MARKET_QUOTES.length);
      intervalId = window.setInterval(() => {
        setQuoteIndex((prev) => (prev + 1) % JOB_MARKET_QUOTES.length);
      }, QUOTE_ROTATE_MS);
    }, msUntilNextQuote);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [showIntroMessage]);

  useEffect(() => {
    if (showIntroMessage) {
      return;
    }

    const tween = animateWords(quoteRef.current);
    return () => {
      tween?.kill();
    };
  }, [showIntroMessage, quoteIndex]);

  useEffect(() => {
    if (showIntroMessage) {
      return;
    }

    const elapsedAfterIntroMs = Math.max(0, getElapsedMs() - INTRO_MESSAGE_MS);
    const remainingRevealDelayMs = Math.max(0, MORPH_REVEAL_DELAY_MS - elapsedAfterIntroMs);
    const timeoutId = window.setTimeout(() => {
      setShouldRevealMorph(true);
    }, remainingRevealDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [showIntroMessage]);

  const showMorph = !showIntroMessage && shouldRevealMorph;

  useEffect(() => {
    if (!showMorph || !morphRef.current) {
      return;
    }

    const tween = gsap.fromTo(
      morphRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.95, ease: "power2.out" },
    );

    return () => {
      tween.kill();
    };
  }, [showMorph]);

  function handleProjectileDone(id: number) {
    setProjectiles((prev) => prev.filter((projectile) => projectile.id !== id));
  }

  return (
    <section
      className={styles.screen}
      role="status"
      aria-live="polite"
      aria-label="Generating your application"
    >
      <div className={styles.stage}>
        <div className={styles.launcher}>
          <img
            src={applicanLogo}
            alt=""
            aria-hidden="true"
            className={styles.logo}
          />

          {projectiles.map((projectile) => (
            <img
              key={projectile.id}
              src={projectile.icon}
              alt=""
              aria-hidden="true"
              className={styles.projectile}
              style={
                {
                  "--tx": `${projectile.tx}px`,
                  "--ty": `${projectile.ty}px`,
                  "--scale": projectile.scale,
                  "--duration": `${projectile.durationMs}ms`,
                  "--spin": `${projectile.spinDeg}deg`,
                  "--delay": `${-(projectile.elapsedMs ?? 0)}ms`,
                } as CSSProperties
              }
              onAnimationEnd={() => handleProjectileDone(projectile.id)}
            />
          ))}
        </div>

        <div className={styles.messageSlot}>
          <p
            className={[
              styles.message,
              showIntroMessage ? styles.messageVisible : styles.messageHidden,
            ].join(" ")}
          >
            {INTRO_MESSAGE}
          </p>
          <p
            ref={quoteRef}
            className={[
              styles.quote,
              showIntroMessage ? styles.messageHidden : styles.messageVisible,
            ].join(" ")}
          >
            {(JOB_MARKET_QUOTES[quoteIndex] ?? "").split(" ").map((word, index, allWords) => (
              <span key={`${word}-${index}`} className={styles.quoteWord} data-quote-word="true">
                {word}
                {index < allWords.length - 1 ? "\u00A0" : ""}
              </span>
            ))}
          </p>
        </div>

        <div
          ref={morphRef}
          className={[
            styles.morphSlot,
            showMorph ? styles.morphSlotVisible : styles.morphSlotHidden,
          ].join(" ")}
        >
          <LoadingMorph progress={backendProgress} />
        </div>

      </div>
    </section>
  );
}
