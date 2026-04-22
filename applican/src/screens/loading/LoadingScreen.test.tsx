import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoadingScreen from "./LoadingScreen.tsx";
import styles from "./LoadingScreen.module.css";

vi.mock("../../effects/splittext", () => ({
  animateWords: vi.fn(() => ({
    kill: vi.fn(),
  })),
}));

vi.mock("gsap", () => ({
  gsap: {
    fromTo: vi.fn(() => ({
      kill: vi.fn(),
    })),
  },
}));

describe("LoadingScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resumes past the intro phase when mounted with an earlier animation origin", () => {
    render(<LoadingScreen backendProgress={78} animationOriginMs={Date.now() - 5_000} />);

    const introMessage = screen.getByText("Generating Resume");
    expect(introMessage.className).toContain(styles.messageHidden);
    expect(screen.getByLabelText("Progress 78 percent")).toBeTruthy();
  });
});
