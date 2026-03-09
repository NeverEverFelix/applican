import { gsap } from "gsap";

const WORD_SELECTOR = "[data-quote-word='true']";

export function animateWords(target: HTMLElement | null) {
  if (!target) {
    return null;
  }

  const words = target.querySelectorAll<HTMLElement>(WORD_SELECTOR);
  if (!words.length) {
    return null;
  }

  return gsap.from(words, {
    y: -100,
    opacity: 0,
    rotation: "random(-80, 80)",
    duration: 0.7,
    ease: "back",
    stagger: 0.15,
    overwrite: true,
  });
}
