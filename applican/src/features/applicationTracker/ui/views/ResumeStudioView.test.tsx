import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ResumeStudioView } from "./ResumeStudioView";
import type { CreateResumeRunResult } from "../../../jobs/model/types";

const { useCreateResumeRunMock, getLatestResumeRunForEditorMock, captureEventMock } = vi.hoisted(() => ({
  useCreateResumeRunMock: vi.fn(),
  getLatestResumeRunForEditorMock: vi.fn(async () => null),
  captureEventMock: vi.fn(),
}));

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
  useCreateResumeRun: () => useCreateResumeRunMock(),
}));

vi.mock("../../../jobs/api/getLatestResumeRunForEditor", () => ({
  getLatestResumeRunForEditor: getLatestResumeRunForEditorMock,
}));

vi.mock("../../../../posthog", () => ({
  captureEvent: captureEventMock,
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
const indexedDbFiles = new Map<string, File>();
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

function createIndexedDbMock() {
  let hasStore = false;

  const database = {
    objectStoreNames: {
      contains: (name: string) => hasStore && name === "resume_files",
    },
    createObjectStore: (name: string) => {
      if (name === "resume_files") {
        hasStore = true;
      }
      return {};
    },
    close: () => undefined,
    transaction: (storeName: string, mode: string) => {
      const transaction = {
        error: null as Error | null,
        oncomplete: null as null | (() => void),
        onerror: null as null | (() => void),
        onabort: null as null | (() => void),
        objectStore: () => ({
          put: (value: File, key: string) => {
            indexedDbFiles.set(key, value);
            window.setTimeout(() => {
              transaction.oncomplete?.();
            }, 0);
          },
          get: (key: string) => {
            const request = {
              result: indexedDbFiles.get(key) ?? null,
              error: null as Error | null,
              onsuccess: null as null | (() => void),
              onerror: null as null | (() => void),
            };

            window.setTimeout(() => {
              request.result = indexedDbFiles.get(key) ?? null;
              request.onsuccess?.();
            }, 0);

            return request;
          },
          delete: (key: string) => {
            indexedDbFiles.delete(key);
            window.setTimeout(() => {
              transaction.oncomplete?.();
            }, 0);
          },
        }),
      };

      if (storeName !== "resume_files" || (mode !== "readonly" && mode !== "readwrite")) {
        throw new Error("Unexpected IndexedDB transaction");
      }

      return transaction;
    },
  };

  return {
    open: () => {
      const request = {
        result: database,
        error: null as Error | null,
        onsuccess: null as null | (() => void),
        onerror: null as null | (() => void),
        onupgradeneeded: null as null | (() => void),
      };

      window.setTimeout(() => {
        if (!hasStore) {
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      }, 0);

      return request;
    },
  };
}

function createFailedRun(): CreateResumeRunResult {
  return {
    requestId: "request-1",
    row: {
      id: "run-1",
      request_id: "request-1",
      user_id: "user-1",
      resume_path: "resume.pdf",
      resume_filename: "resume.pdf",
      job_description: "Software engineer",
      status: "failed",
      error_code: "worker_offline",
      error_message: "worker offline",
      output: null,
      created_at: "2026-04-16T00:00:00.000Z",
      updated_at: "2026-04-16T00:00:00.000Z",
    },
  };
}

afterEach(() => {
  cleanup();
  localStorageMock.clear();
  indexedDbFiles.clear();
  vi.useRealTimers();
});

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
  Object.defineProperty(window, "indexedDB", {
    value: createIndexedDbMock(),
    configurable: true,
  });
  localStorageMock.clear();
  indexedDbFiles.clear();
  useCreateResumeRunMock.mockReturnValue({
    submitResumeRun: vi.fn(),
    retryResumeRun: vi.fn(),
    resumeStoredRun: vi.fn(async () => null),
    cancelActiveRun: vi.fn(async () => ({ ok: true })),
    clearPersistedRunState: vi.fn(),
    isSubmitting: false,
    errorKind: null,
    errorMessage: "",
    errorFeedback: { tone: "error", retryable: false, message: "" },
    progressMessage: "",
    progressPercent: 0,
    createdRun: null,
    failedRun: null,
    hasPersistedRunState: false,
  });
  getLatestResumeRunForEditorMock.mockResolvedValue(null);
  captureEventMock.mockReset();
});

describe("ResumeStudioView", () => {
  it("tracks results viewed, section expansion, and starting a new analysis from results", () => {
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
                original: "Original bullet",
                optimized: "Optimized bullet",
                action: "replace",
              },
            ],
          },
        ],
      }),
    );
    window.localStorage.setItem(
      "applican:resume-studio:last-run-context",
      JSON.stringify({
        run_id: "run-1",
        request_id: "request-1",
        job_title: "Product Support Engineer",
        match_score: 87,
      }),
    );

    render(<ResumeStudioView />);

    expect(captureEventMock).toHaveBeenCalledWith("results_viewed", {
      run_id: "run-1",
      request_id: "request-1",
      company: "Wavform",
      title: "Product Support Engineer",
      match_score: 87,
      strengths_count: 1,
      gaps_count: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: /Product Support Engineer/i }));

    expect(captureEventMock).toHaveBeenCalledWith("optimization_section_expanded", {
      run_id: "run-1",
      request_id: "request-1",
      section_id: "exp:0",
      section_kind: "experience",
      job_title: "Product Support Engineer",
      match_score: 87,
      action: "expand",
    });

    fireEvent.click(screen.getByRole("button", { name: /new analysis/i }));

    expect(captureEventMock).toHaveBeenCalledWith(
      "new_run_started",
      expect.objectContaining({
        run_id: "run-1",
        request_id: "request-1",
        job_title: "Product Support Engineer",
        match_score: 87,
      }),
    );
  });

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

  it("shows the loading screen when a persisted run is still resuming", () => {
    useCreateResumeRunMock.mockReturnValue({
      submitResumeRun: vi.fn(),
      retryResumeRun: vi.fn(),
      resumeStoredRun: vi.fn(async () => null),
      cancelActiveRun: vi.fn(async () => ({ ok: true })),
      clearPersistedRunState: vi.fn(),
      isSubmitting: true,
      errorKind: null,
      errorMessage: "",
      errorFeedback: { tone: "error", retryable: false, message: "" },
      progressMessage: "Generating bullets...",
      progressPercent: 78,
      createdRun: null,
      failedRun: null,
      hasPersistedRunState: true,
    });

    render(<ResumeStudioView />);

    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Paste a job description...")).toBeNull();
  });

  it("does not auto-resume a persisted failed run", () => {
    const resumeStoredRunMock = vi.fn(async () => null);

    useCreateResumeRunMock.mockReturnValue({
      submitResumeRun: vi.fn(),
      retryResumeRun: vi.fn(),
      resumeStoredRun: resumeStoredRunMock,
      cancelActiveRun: vi.fn(async () => ({ ok: true })),
      clearPersistedRunState: vi.fn(),
      isSubmitting: false,
      errorKind: "retryable",
      errorMessage: "worker offline",
      errorFeedback: {
        tone: "warning",
        retryable: true,
        message: "worker offline Your draft is still saved, so you can try again in a moment.",
      },
      progressMessage: "",
      progressPercent: 0,
      createdRun: null,
      failedRun: {
        requestId: "request-1",
        row: {
          id: "run-1",
          request_id: "request-1",
          user_id: "user-1",
          resume_path: "resume.pdf",
          resume_filename: "resume.pdf",
          job_description: "Software engineer",
          status: "failed",
          error_code: "worker_offline",
          error_message: "worker offline",
          output: null,
          created_at: "2026-04-16T00:00:00.000Z",
          updated_at: "2026-04-16T00:00:00.000Z",
        },
      },
      hasPersistedRunState: true,
    });

    render(<ResumeStudioView />);

    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
    expect(resumeStoredRunMock).not.toHaveBeenCalled();
  });

  it("does not auto-resume when retry switches the view back into submitting", () => {
    const resumeStoredRunMock = vi.fn(async () => null);
    const retryResumeRunMock = vi.fn(async () => ({ ok: false, errorMessage: "worker offline" }));
    const useCreateResumeRunState = {
      submitResumeRun: vi.fn(),
      retryResumeRun: retryResumeRunMock,
      resumeStoredRun: resumeStoredRunMock,
      cancelActiveRun: vi.fn(async () => ({ ok: true })),
      clearPersistedRunState: vi.fn(),
      isSubmitting: false,
      errorKind: "retryable",
      errorMessage: "worker offline",
      errorFeedback: {
        tone: "warning",
        retryable: true,
        message: "worker offline Your draft is still saved, so you can try again in a moment.",
      },
      progressMessage: "",
      progressPercent: 0,
      createdRun: null,
      failedRun: createFailedRun() as CreateResumeRunResult | null,
      hasPersistedRunState: true,
    };

    useCreateResumeRunMock.mockImplementation(() => useCreateResumeRunState);

    const { rerender } = render(<ResumeStudioView />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    useCreateResumeRunState.isSubmitting = true;
    useCreateResumeRunState.errorMessage = "";
    useCreateResumeRunState.failedRun = null;

    rerender(<ResumeStudioView />);

    expect(retryResumeRunMock).toHaveBeenCalledTimes(1);
    expect(resumeStoredRunMock).not.toHaveBeenCalled();
  });

  it("returns to the error screen when retry fails again without re-triggering persisted restore", () => {
    const resumeStoredRunMock = vi.fn(async () => null);
    const retryResumeRunMock = vi.fn(async () => ({
      ok: false as const,
      errorKind: "retryable" as const,
      errorMessage: "worker offline",
    }));
    const useCreateResumeRunState = {
      submitResumeRun: vi.fn(),
      retryResumeRun: retryResumeRunMock,
      resumeStoredRun: resumeStoredRunMock,
      cancelActiveRun: vi.fn(async () => ({ ok: true })),
      clearPersistedRunState: vi.fn(),
      isSubmitting: false,
      errorKind: "retryable" as const,
      errorMessage: "worker offline",
      errorFeedback: {
        tone: "warning" as const,
        retryable: true,
        message: "worker offline Your draft is still saved, so you can try again in a moment.",
      },
      progressMessage: "",
      progressPercent: 0,
      createdRun: null,
      failedRun: createFailedRun() as CreateResumeRunResult | null,
      hasPersistedRunState: true,
    };

    useCreateResumeRunMock.mockImplementation(() => useCreateResumeRunState);

    const { rerender } = render(<ResumeStudioView />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    useCreateResumeRunState.isSubmitting = true;
    useCreateResumeRunState.errorMessage = "";
    useCreateResumeRunState.failedRun = null;

    rerender(<ResumeStudioView />);

    expect(screen.getByText("Loading")).toBeTruthy();

    useCreateResumeRunState.isSubmitting = false;
    useCreateResumeRunState.errorKind = "retryable";
    useCreateResumeRunState.errorMessage = "worker offline";
    useCreateResumeRunState.errorFeedback = {
      tone: "warning",
      retryable: true,
      message: "worker offline Your draft is still saved, so you can try again in a moment.",
    };
    useCreateResumeRunState.failedRun = createFailedRun();

    rerender(<ResumeStudioView />);

    expect(screen.queryByText("Loading")).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
    expect(screen.getByText(/worker offline/i)).toBeTruthy();
    expect(retryResumeRunMock).toHaveBeenCalledTimes(1);
    expect(resumeStoredRunMock).not.toHaveBeenCalled();
  });

  it("hides try again for missing-run recovery errors", () => {
    useCreateResumeRunMock.mockReturnValue({
      submitResumeRun: vi.fn(),
      retryResumeRun: vi.fn(),
      resumeStoredRun: vi.fn(async () => null),
      cancelActiveRun: vi.fn(async () => ({ ok: true })),
      clearPersistedRunState: vi.fn(),
      isSubmitting: false,
      errorKind: "missing_run",
      errorMessage: "Your previous run could not be restored. Start a new analysis.",
      errorFeedback: {
        tone: "error",
        retryable: false,
        message: "Your previous run could not be restored. Start a new analysis.",
      },
      progressMessage: "",
      progressPercent: 0,
      createdRun: null,
      failedRun: {
        requestId: "request-1",
        row: {
          id: "run-1",
          request_id: "request-1",
          user_id: "user-1",
          resume_path: "resume.pdf",
          resume_filename: "resume.pdf",
          job_description: "Software engineer",
          status: "failed",
          error_code: null,
          error_message: null,
          output: null,
          created_at: "2026-04-16T00:00:00.000Z",
          updated_at: "2026-04-16T00:00:00.000Z",
        },
      },
      hasPersistedRunState: false,
    });

    render(<ResumeStudioView />);

    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    expect(screen.getByRole("button", { name: /start new/i })).toBeTruthy();
    expect(screen.getByText(/could not be restored/i)).toBeTruthy();
  });

  it("keeps the loading flow visible while a successful submission transitions into the analysis-complete screen", async () => {
    vi.useFakeTimers();
    const uploadedResume = new File(["resume"], "resume.pdf", { type: "application/pdf" });

    const successfulRun = {
      requestId: "request-1",
      row: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer role",
        status: "completed" as const,
        error_code: null,
        error_message: null,
        output: {
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
        },
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    };

    const useCreateResumeRunState = {
      submitResumeRun: vi.fn(async () => {
        useCreateResumeRunState.isSubmitting = true;
        rerender(<ResumeStudioView />);
        await Promise.resolve();
        useCreateResumeRunState.isSubmitting = false;
        useCreateResumeRunState.createdRun = successfulRun;
        rerender(<ResumeStudioView />);
        return { ok: true as const, createdRun: successfulRun, requestId: successfulRun.requestId };
      }),
      retryResumeRun: vi.fn(),
      resumeStoredRun: vi.fn(async () => null),
      cancelActiveRun: vi.fn(async () => ({ ok: true })),
      clearPersistedRunState: vi.fn(),
      isSubmitting: false,
      errorKind: null,
      errorMessage: "",
      errorFeedback: { tone: "error" as const, retryable: false, message: "" },
      progressMessage: "",
      progressPercent: 78,
      createdRun: null as CreateResumeRunResult | null,
      failedRun: null,
      hasPersistedRunState: false,
    };

    useCreateResumeRunMock.mockImplementation(() => useCreateResumeRunState);

    const { container, rerender } = render(<ResumeStudioView />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [uploadedResume] },
    });

    fireEvent.change(screen.getByPlaceholderText("Paste a job description..."), {
      target: { value: "A".repeat(201) },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate result/i }));
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(useCreateResumeRunState.submitResumeRun).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Paste a job description...")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(220);
    });

    expect(screen.queryByText("Loading")).toBeNull();
    expect(screen.getByText("Analyzing Complete")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Paste a job description...")).toBeNull();
  });
});
