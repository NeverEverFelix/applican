import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ResumeStudioView } from "./ResumeStudioView";

vi.mock("@posthog/react", () => ({
  usePostHog: () => ({
    capture: vi.fn(),
  }),
}));

vi.mock("gsap", () => ({
  default: {
    killTweensOf: vi.fn(),
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}));

vi.mock("../../../jobs/hooks/useCreateResumeRun", () => ({
  useCreateResumeRun: () => ({
    submitResumeRun: vi.fn(),
    isSubmitting: false,
    errorMessage: "",
    progressMessage: "",
    progressPercent: 0,
    createdRun: null,
  }),
}));

vi.mock("../../../jobs/api/getLatestResumeRunForEditor", () => ({
  getLatestResumeRunForEditor: vi.fn(async () => null),
}));

vi.mock("../../../../screens/loading/LoadingScreen.tsx", () => ({
  default: () => <div>Loading</div>,
}));

vi.mock("../../../../effects/writing-text", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("../../../../effects/typing-text", () => ({
  default: ({ text, as: Component = "span", className }: { text: string; as?: "span"; className?: string }) => (
    <Component className={className}>{text}</Component>
  ),
}));

vi.mock("../../../../effects/ScrollSections", () => ({
  default: ({ sections }: { sections: Array<{ id: string; content: ReactNode }> }) => (
    <div>
      {sections.map((section) => (
        <div key={section.id}>{section.content}</div>
      ))}
    </div>
  ),
}));

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
};

afterEach(() => {
  cleanup();
  localStorageMock.clear();
});

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
  localStorageMock.clear();
});

describe("ResumeStudioView", () => {
  it("renders optimization accordions from backend optimization_sections and reveals optimized bullets on expand", async () => {
    window.localStorage.setItem("applican:resume-studio:show-results", JSON.stringify(true));
    window.localStorage.setItem(
      "applican:resume-studio:last-run-output",
      JSON.stringify({
        job: {
          company: "Wavform",
          title: "Product Support Engineer",
        },
        match: {
          score: 87,
          label: "87% Match",
          summary: "Strong support alignment.",
        },
        analysis: {
          strengths: ["Strong troubleshooting background"],
          gaps: ["Needs more direct SaaS metrics"],
        },
        optimization_sections: [
          {
            id: "exp:0",
            kind: "experience",
            source_index: 0,
            display_title: "Product Support Engineer",
            bullets: [
              {
                id: "exp:0:0",
                source_index: 0,
                original:
                  "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
                optimized:
                  "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
                action: "replace",
              },
            ],
          },
          {
            id: "proj:0",
            kind: "project",
            source_index: 0,
            display_title: "Support Dashboard",
            bullets: [
              {
                id: "proj:0:0",
                source_index: 0,
                original: "Built internal reporting dashboard",
                optimized: "Built an internal reporting dashboard that reduced support triage time by 18%",
                action: "replace",
              },
            ],
          },
        ],
      }),
    );

    render(<ResumeStudioView />);

    expect(screen.getByRole("button", { name: /Product Support Engineer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Support Dashboard/i })).toBeTruthy();
    expect(
      screen.getByText(
        "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
      ),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Product Support Engineer/i }));

    expect(
      screen.getByText(
        "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
      ),
    ).toBeTruthy();
  });
});
