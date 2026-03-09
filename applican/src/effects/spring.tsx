import type { Variants, Transition } from "framer-motion";

export const dropdownSpring: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 7,
  mass: 0.85,
  velocity: 3,
};

export const dropdownVariants: Variants = {
  closed: {
    opacity: 0,
    y: -36,
    scale: 0.92,
    filter: "blur(12px)",
    transformOrigin: "top right",
    transformPerspective: 900,
    transition: {
      duration: 0.32,
      ease: [0.4, 0, 1, 1],
      when: "afterChildren",
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transformOrigin: "top right",
    transformPerspective: 900,
    transition: {
      ...dropdownSpring,
      when: "beforeChildren",
      staggerChildren: 0.07,
      delayChildren: 0.06,
    },
  },
};

export const dropdownItemVariants: Variants = {
  closed: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    filter: "blur(8px)",
    transition: {
      duration: 0.24,
      ease: [0.4, 0, 1, 1],
    },
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};
