import { useEffect, useRef, useState, type CSSProperties } from "react";
import applicanLogo from "../../assets/applican.svg";
import { animateWords } from "../../effects/splittext";
import styles from "./LoadingScreen.module.css";
import {
  buildResumeProjectile,
  INTRO_MESSAGE,
  INTRO_MESSAGE_MS,
  JOB_MARKET_QUOTES,
  QUOTE_ROTATE_MS,
  type ResumeProjectile,
} from "./LoadingScreen";

const SPAWN_INTERVAL_MS = 240;
const MAX_PROJECTILES = 18;

export default function LoadingScreen() {
  const [projectiles, setProjectiles] = useState<ResumeProjectile[]>([]);
  const [showIntroMessage, setShowIntroMessage] = useState(true);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const nextId = useRef(1);
  const quoteRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProjectiles((prev) => {
        const next = [...prev, buildResumeProjectile(nextId.current)];
        nextId.current += 1;
        return next.slice(-MAX_PROJECTILES);
      });
    }, SPAWN_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowIntroMessage(false);
    }, INTRO_MESSAGE_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (showIntroMessage || JOB_MARKET_QUOTES.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % JOB_MARKET_QUOTES.length);
    }, QUOTE_ROTATE_MS);

    return () => window.clearInterval(intervalId);
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
      </div>
    </section>
  );
}
