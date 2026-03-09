import gsap from "gsap";
import { Flip } from "gsap/all";

gsap.registerPlugin(Flip);

const FLIP_TARGET_SELECTOR = "[data-editor-flip]";

type EditorFlipState = ReturnType<typeof Flip.getState>;

export function captureEditorFlipState(root: HTMLElement | null): EditorFlipState | null {
  if (!root) {
    return null;
  }

  const targets = root.querySelectorAll(FLIP_TARGET_SELECTOR);
  if (targets.length === 0) {
    return null;
  }

  return Flip.getState(targets);
}

export function animateEditorFlip(state: EditorFlipState | null): void {
  if (!state) {
    return;
  }

  Flip.from(state, {
    absolute: true,
    duration: 0.48,
    ease: "power2.inOut",
    simple: true,
  });
}
