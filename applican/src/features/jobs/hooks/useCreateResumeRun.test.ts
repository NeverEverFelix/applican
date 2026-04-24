import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureExceptionMock,
  captureEventMock,
  createResumeRunMock,
  deleteResumeRunMock,
  getResumeRunMock,
  invokeGenerateBulletsMock,
  requeueResumeRunMock,
  waitForRunExtractionMock,
} = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  captureEventMock: vi.fn(),
  createResumeRunMock: vi.fn(),
  deleteResumeRunMock: vi.fn(),
  getResumeRunMock: vi.fn(),
  invokeGenerateBulletsMock: vi.fn(),
  requeueResumeRunMock: vi.fn(),
  waitForRunExtractionMock: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("../../../posthog", () => ({
  captureEvent: captureEventMock,
}));

vi.mock("../api/createResumeRun", () => ({
  createResumeRun: createResumeRunMock,
}));

vi.mock("../api/deleteResumeRun", () => ({
  deleteResumeRun: deleteResumeRunMock,
}));

vi.mock("../api/getResumeRun", () => ({
  getResumeRun: getResumeRunMock,
}));

vi.mock("../api/invokeGenerateBullets", () => ({
  invokeGenerateBullets: invokeGenerateBulletsMock,
}));

vi.mock("../api/requeueResumeRun", () => ({
  requeueResumeRun: requeueResumeRunMock,
}));

vi.mock("../api/waitForRunExtraction", () => ({
  waitForRunExtraction: waitForRunExtractionMock,
}));

import { useCreateResumeRun } from "./useCreateResumeRun";
import { classifyResumeRunErrorKind, getResumeRunErrorFeedback } from "./useCreateResumeRun";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};

describe("useCreateResumeRun", () => {
  const clearResumeStudioStorage = () => {
    localStorageMock.removeItem("applican:resume-studio:active-run-session");
    localStorageMock.removeItem("applican:resume-studio:last-run-output");
    localStorageMock.removeItem("applican:resume-studio:show-results");
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    clearResumeStudioStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearResumeStudioStorage();
  });

  it("classifies common resume run error kinds", () => {
    expect(classifyResumeRunErrorKind("worker offline")).toBe("retryable");
    expect(classifyResumeRunErrorKind("Resume generation failed.", "FREE_PLAN_LIMIT_REACHED")).toBe("limit");
    expect(classifyResumeRunErrorKind("Resume generation failed.", "worker_offline")).toBe("retryable");
    expect(
      classifyResumeRunErrorKind("Your previous run could not be restored. Start a new analysis."),
    ).toBe("missing_run");
    expect(classifyResumeRunErrorKind("Please upload a resume file in PDF or Word format.")).toBe("validation");
    expect(classifyResumeRunErrorKind("Free plan limit reached")).toBe("limit");
  });

  it("maps resume run errors into UI feedback", () => {
    expect(
      getResumeRunErrorFeedback("worker offline", "retryable"),
    ).toEqual({
      tone: "warning",
      retryable: true,
      message: "worker offline Your draft is still saved, so you can try again in a moment.",
    });
    expect(
      getResumeRunErrorFeedback(
        "Your previous run could not be restored. Start a new analysis.",
        "missing_run",
      ),
    ).toEqual({
      tone: "error",
      retryable: false,
      message: "Your previous run could not be restored. Start a new analysis.",
    });
  });

  it("returns a structured validation error when submission fails before a run is created", async () => {
    createResumeRunMock.mockRejectedValue(new Error("Please upload a resume file."));

    const { result } = renderHook(() => useCreateResumeRun());

    let submitResult:
      | Awaited<ReturnType<typeof result.current.submitResumeRun>>
      | undefined;

    await act(async () => {
      submitResult = await result.current.submitResumeRun({
        file: null,
        jobDescription: "Software engineer",
      });
    });

    expect(result.current.errorKind).toBe("validation");
    expect(result.current.errorMessage).toBe("Please upload a resume file.");
    expect(result.current.progressPercent).toBe(0);
    expect(result.current.hasPersistedRunState).toBe(false);
    expect(window.localStorage.getItem("applican:resume-studio:active-run-session")).toBeNull();
    expect(submitResult).toEqual({
      ok: false,
      errorKind: "validation",
      errorMessage: "Please upload a resume file.",
    });
  });

  it("submits a run successfully and exposes the completed run", async () => {
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    const created = {
      requestId: "request-1",
      row: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: "queued",
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    };
    const generatedRun = {
      ...created.row,
      status: "extracted",
      output: { bullets: ["A"] },
    };

    createResumeRunMock.mockResolvedValue(created);
    waitForRunExtractionMock.mockResolvedValue(undefined);
    invokeGenerateBulletsMock.mockResolvedValue({ run: generatedRun });

    const { result } = renderHook(() => useCreateResumeRun());

    let submitResult:
      | Awaited<ReturnType<typeof result.current.submitResumeRun>>
      | undefined;

    await act(async () => {
      submitResult = await result.current.submitResumeRun({
        file,
        jobDescription: "  Software engineer  ",
      });
    });

    expect(createResumeRunMock).toHaveBeenCalledWith({
      file,
      jobDescription: "  Software engineer  ",
    });
    expect(waitForRunExtractionMock).toHaveBeenCalledWith({ runId: "run-1" });
    expect(invokeGenerateBulletsMock).toHaveBeenCalledWith({
      runId: "run-1",
      requestId: "request-1",
    });
    expect(captureEventMock).toHaveBeenCalledWith("run_created", {
      run_id: "run-1",
      request_id: "request-1",
      has_job_description: true,
      has_resume_file: true,
    });
    expect(captureEventMock).toHaveBeenCalledWith("extract_started", {
      run_id: "run-1",
      request_id: "request-1",
    });
    expect(captureEventMock).toHaveBeenCalledWith("extract_succeeded", {
      run_id: "run-1",
      request_id: "request-1",
    });
    expect(captureEventMock).toHaveBeenCalledWith("rag_started", {
      run_id: "run-1",
      request_id: "request-1",
    });
    expect(captureEventMock).toHaveBeenCalledWith("rag_succeeded", {
      run_id: "run-1",
      request_id: "request-1",
    });
    expect(result.current.progressPercent).toBe(100);
    expect(result.current.progressMessage).toBe("");
    expect(result.current.errorMessage).toBe("");
    expect(result.current.createdRun).toEqual({
      requestId: "request-1",
      row: generatedRun,
    });
    expect(submitResult).toEqual({
      ok: true,
      createdRun: {
        requestId: "request-1",
        row: generatedRun,
      },
    });
  });

  it("surfaces extraction failure and captures analytics plus sentry", async () => {
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    const created = {
      requestId: "request-1",
      row: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: "queued",
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    };

    createResumeRunMock.mockResolvedValue(created);
    waitForRunExtractionMock.mockRejectedValue(new Error("worker offline"));

    const { result } = renderHook(() => useCreateResumeRun());

    let submitResult:
      | Awaited<ReturnType<typeof result.current.submitResumeRun>>
      | undefined;

    await act(async () => {
      submitResult = await result.current.submitResumeRun({
        file,
        jobDescription: "Software engineer",
      });
    });

    expect(captureEventMock).toHaveBeenCalledWith("extract_failed", {
      run_id: "run-1",
      request_id: "request-1",
      error_message: "worker offline",
    });
    expect(captureExceptionMock).toHaveBeenCalled();
    expect(result.current.errorKind).toBe("retryable");
    expect(result.current.errorMessage).toBe("worker offline");
    expect(result.current.createdRun).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(
      JSON.parse(window.localStorage.getItem("applican:resume-studio:active-run-session") ?? "null"),
    ).toEqual({
      runId: "run-1",
      requestId: "request-1",
      status: "queued",
      phase: "failed",
      progressMessage: "",
      progressPercent: 0,
      errorKind: "retryable",
      errorMessage: "worker offline",
    });
    expect(submitResult).toEqual({
      ok: false,
      errorKind: "retryable",
      errorMessage: "worker offline",
    });
  });

  it("retries bullet generation when extraction is still finishing", async () => {
    vi.useFakeTimers();

    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    const created = {
      requestId: "request-1",
      row: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: "queued",
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    };
    const generatedRun = {
      ...created.row,
      status: "extracted",
      output: { bullets: ["A"] },
    };

    createResumeRunMock.mockResolvedValue(created);
    waitForRunExtractionMock.mockResolvedValue(undefined);
    invokeGenerateBulletsMock
      .mockRejectedValueOnce(
        new Error(
          "Failed to generate bullets: Resume is still being extracted. Wait a few seconds, then try again.",
        ),
      )
      .mockResolvedValueOnce({ run: generatedRun });

    const { result } = renderHook(() => useCreateResumeRun());

    let submitPromise!: Promise<Awaited<ReturnType<typeof result.current.submitResumeRun>>>;

    await act(async () => {
      submitPromise = result.current.submitResumeRun({
        file,
        jobDescription: "Software engineer",
      });
      await vi.advanceTimersByTimeAsync(1_500);
    });

    const submitResult = await act(async () => submitPromise);

    expect(invokeGenerateBulletsMock).toHaveBeenCalledTimes(2);
    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(submitResult).toEqual({
      ok: true,
      createdRun: {
        requestId: "request-1",
        row: generatedRun,
      },
    });
  });

  it("retries the failed run without creating a duplicate run", async () => {
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    const created = {
      requestId: "request-1",
      row: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: "queued",
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    };
    const generatedRun = {
      ...created.row,
      status: "extracted",
      output: { bullets: ["A"] },
    };

    createResumeRunMock.mockResolvedValue(created);
    waitForRunExtractionMock
      .mockRejectedValueOnce(new Error("worker offline"))
      .mockResolvedValueOnce(undefined);
    requeueResumeRunMock.mockResolvedValue(created);
    invokeGenerateBulletsMock.mockResolvedValue({ run: generatedRun });

    const { result } = renderHook(() => useCreateResumeRun());

    await act(async () => {
      await result.current.submitResumeRun({
        file,
        jobDescription: "Software engineer",
      });
    });

    let retryResult:
      | Awaited<ReturnType<typeof result.current.retryResumeRun>>
      | undefined;

    await act(async () => {
      retryResult = await result.current.retryResumeRun();
    });

    expect(createResumeRunMock).toHaveBeenCalledTimes(1);
    expect(requeueResumeRunMock).toHaveBeenCalledWith({ runId: "run-1" });
    expect(waitForRunExtractionMock).toHaveBeenCalledTimes(2);
    expect(invokeGenerateBulletsMock).toHaveBeenCalledWith({
      runId: "run-1",
      requestId: "request-1",
    });
    expect(retryResult).toEqual({
      ok: true,
      createdRun: {
        requestId: "request-1",
        row: generatedRun,
      },
    });
  });

  it("clears the previous persisted failure immediately when a retry starts", async () => {
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    const created = {
      requestId: "request-1",
      row: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: "queued",
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    };

    createResumeRunMock.mockResolvedValue(created);
    waitForRunExtractionMock.mockRejectedValueOnce(new Error("worker offline"));

    let resolveRetry!: (value: typeof created) => void;
    requeueResumeRunMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
    );

    const { result } = renderHook(() => useCreateResumeRun());

    await act(async () => {
      await result.current.submitResumeRun({
        file,
        jobDescription: "Software engineer",
      });
    });

    expect(window.localStorage.getItem("applican:resume-studio:active-run-session")).not.toBeNull();

    await act(async () => {
      void result.current.retryResumeRun();
      await Promise.resolve();
    });

    expect(result.current.hasPersistedRunState).toBe(false);
    expect(result.current.errorKind).toBeNull();
    expect(window.localStorage.getItem("applican:resume-studio:active-run-session")).toBeNull();

    await act(async () => {
      resolveRetry(created);
      await Promise.resolve();
    });
  });

  it("resumes a persisted in-progress run and exposes the completed result", async () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        runId: "run-1",
        requestId: "request-1",
        row: {
          id: "run-1",
          request_id: "request-1",
          user_id: "user-1",
          resume_path: "resume.pdf",
          resume_filename: "resume.pdf",
          job_description: "Software engineer",
          status: "queued",
          error_code: null,
          error_message: null,
          output: null,
          created_at: "2026-04-16T00:00:00.000Z",
          updated_at: "2026-04-16T00:00:00.000Z",
        },
        phase: "extracting",
        progressMessage: "Waiting for extraction service...",
        progressPercent: 42,
        errorKind: null,
        errorMessage: "",
      }),
    );

    const generatedRun = {
      id: "run-1",
      request_id: "request-1",
      user_id: "user-1",
      resume_path: "resume.pdf",
      resume_filename: "resume.pdf",
      job_description: "Software engineer",
      status: "extracted",
      error_code: null,
      error_message: null,
      output: { bullets: ["A"] },
      created_at: "2026-04-16T00:00:00.000Z",
      updated_at: "2026-04-16T00:00:00.000Z",
    };

    getResumeRunMock.mockResolvedValue({
      ...generatedRun,
      output: null,
    });
    waitForRunExtractionMock.mockResolvedValue(undefined);
    invokeGenerateBulletsMock.mockResolvedValue({ run: generatedRun });

    const { result } = renderHook(() => useCreateResumeRun());

    let resumeResult:
      | Awaited<ReturnType<typeof result.current.resumeStoredRun>>
      | undefined;

    await act(async () => {
      resumeResult = await result.current.resumeStoredRun();
    });

    expect(getResumeRunMock).toHaveBeenCalledWith({ runId: "run-1" });
    expect(waitForRunExtractionMock).not.toHaveBeenCalled();
    expect(invokeGenerateBulletsMock).toHaveBeenCalledWith({
      runId: "run-1",
      requestId: "request-1",
    });
    expect(result.current.createdRun).toEqual({
      requestId: "request-1",
      row: generatedRun,
    });
    expect(result.current.hasPersistedRunState).toBe(false);
    expect(window.localStorage.getItem("applican:resume-studio:active-run-session")).toBeNull();
    expect(window.localStorage.getItem("applican:resume-studio:show-results")).toBe("true");
    expect(resumeResult).toEqual({
      ok: true,
      createdRun: {
        requestId: "request-1",
        row: generatedRun,
      },
    });
  });

  it("resumes a persisted run that has already advanced to queued_pdf without waiting for extraction", async () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        runId: "run-1",
        requestId: "request-1",
        row: {
          id: "run-1",
          request_id: "request-1",
          user_id: "user-1",
          resume_path: "resume.pdf",
          resume_filename: "resume.pdf",
          job_description: "Software engineer",
          status: "queued_pdf",
          error_code: null,
          error_message: null,
          output: null,
          created_at: "2026-04-16T00:00:00.000Z",
          updated_at: "2026-04-16T00:00:00.000Z",
        },
        phase: "generating",
        progressMessage: "Generating bullets...",
        progressPercent: 78,
        errorKind: null,
        errorMessage: "",
      }),
    );

    const generatedRun = {
      id: "run-1",
      request_id: "request-1",
      user_id: "user-1",
      resume_path: "resume.pdf",
      resume_filename: "resume.pdf",
      job_description: "Software engineer",
      status: "queued_pdf",
      error_code: null,
      error_message: null,
      output: { bullets: ["A"] },
      created_at: "2026-04-16T00:00:00.000Z",
      updated_at: "2026-04-16T00:00:00.000Z",
    };

    getResumeRunMock.mockResolvedValue({
      ...generatedRun,
      output: null,
    });
    invokeGenerateBulletsMock.mockResolvedValue({ run: generatedRun });

    const { result } = renderHook(() => useCreateResumeRun());

    await act(async () => {
      await result.current.resumeStoredRun();
    });

    expect(waitForRunExtractionMock).not.toHaveBeenCalled();
    expect(invokeGenerateBulletsMock).toHaveBeenCalledWith({
      runId: "run-1",
      requestId: "request-1",
    });
    expect(result.current.createdRun).toEqual({
      requestId: "request-1",
      row: generatedRun,
    });
  });

  it("surfaces compile-stage progress when a restored run is already queued for pdf work", async () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        runId: "run-1",
        requestId: "request-1",
        row: {
          id: "run-1",
          request_id: "request-1",
          user_id: "user-1",
          resume_path: "resume.pdf",
          resume_filename: "resume.pdf",
          job_description: "Software engineer",
          status: "queued_pdf",
          error_code: null,
          error_message: null,
          output: null,
          created_at: "2026-04-16T00:00:00.000Z",
          updated_at: "2026-04-16T00:00:00.000Z",
        },
        phase: "compiling",
        progressMessage: "Preparing PDF...",
        progressPercent: 92,
        errorKind: null,
        errorMessage: "",
      }),
    );

    getResumeRunMock.mockResolvedValue(null);

    const { result } = renderHook(() => useCreateResumeRun());

    expect(result.current.progressMessage).toBe("Preparing PDF...");
    expect(result.current.progressPercent).toBe(92);
  });

  it("treats a persisted failed run as terminal without re-fetching it", async () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        runId: "run-1",
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
        phase: "failed",
        progressMessage: "",
        progressPercent: 0,
        errorKind: "retryable",
        errorMessage: "worker offline",
      }),
    );

    const { result } = renderHook(() => useCreateResumeRun());

    let resumeResult:
      | Awaited<ReturnType<typeof result.current.resumeStoredRun>>
      | undefined;

    await act(async () => {
      resumeResult = await result.current.resumeStoredRun();
    });

    expect(getResumeRunMock).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.hasPersistedRunState).toBe(true);
    expect(result.current.errorMessage).toBe("worker offline");
    expect(resumeResult).toEqual({
      ok: false,
      errorKind: "retryable",
      errorMessage: "worker offline",
    });
  });

  it("clears stale persisted state when the stored run no longer exists", async () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        runId: "run-1",
        requestId: "request-1",
        row: {
          id: "run-1",
          request_id: "request-1",
          user_id: "user-1",
          resume_path: "resume.pdf",
          resume_filename: "resume.pdf",
          job_description: "Software engineer",
          status: "extracting",
          error_code: null,
          error_message: null,
          output: null,
          created_at: "2026-04-16T00:00:00.000Z",
          updated_at: "2026-04-16T00:00:00.000Z",
        },
        phase: "extracting",
        progressMessage: "Waiting for extraction service...",
        progressPercent: 42,
        errorKind: null,
        errorMessage: "",
      }),
    );

    getResumeRunMock.mockResolvedValue(null);

    const { result } = renderHook(() => useCreateResumeRun());

    let resumeResult:
      | Awaited<ReturnType<typeof result.current.resumeStoredRun>>
      | undefined;

    await act(async () => {
      resumeResult = await result.current.resumeStoredRun();
    });

    expect(getResumeRunMock).toHaveBeenCalledWith({ runId: "run-1" });
    expect(result.current.hasPersistedRunState).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.errorKind).toBeNull();
    expect(result.current.failedRun).toBeNull();
    expect(window.localStorage.getItem("applican:resume-studio:active-run-session")).toBeNull();
    expect(resumeResult).toEqual({
      ok: false,
      errorKind: "missing_run",
      errorMessage: "Your previous run could not be restored. Start a new analysis.",
    });
  });

  it("classifies a restored failed run from backend error_code when the message is generic", async () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        runId: "run-1",
        requestId: "request-1",
        phase: "extracting",
        progressMessage: "Waiting for extraction service...",
        progressPercent: 42,
        errorKind: null,
        errorMessage: "",
      }),
    );

    getResumeRunMock.mockResolvedValue({
      id: "run-1",
      request_id: "request-1",
      user_id: "user-1",
      resume_path: "resume.pdf",
      resume_filename: "resume.pdf",
      job_description: "Software engineer",
      status: "failed",
      error_code: "FREE_PLAN_LIMIT_REACHED",
      error_message: "Resume generation failed.",
      output: null,
      created_at: "2026-04-16T00:00:00.000Z",
      updated_at: "2026-04-16T00:00:00.000Z",
    });

    const { result } = renderHook(() => useCreateResumeRun());

    let resumeResult:
      | Awaited<ReturnType<typeof result.current.resumeStoredRun>>
      | undefined;

    await act(async () => {
      resumeResult = await result.current.resumeStoredRun();
    });

    expect(result.current.errorKind).toBe("limit");
    expect(result.current.errorFeedback.retryable).toBe(false);
    expect(resumeResult).toEqual({
      ok: false,
      errorKind: "limit",
      errorMessage: "Resume generation failed.",
    });
  });

  it("prefers persisted error kind when restoring a failed session", () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        runId: "run-1",
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
        phase: "failed",
        progressMessage: "",
        progressPercent: 0,
        errorKind: "retryable",
        errorMessage: "temporary backend issue",
      }),
    );

    const { result } = renderHook(() => useCreateResumeRun());

    expect(result.current.errorKind).toBe("retryable");
    expect(result.current.errorFeedback.retryable).toBe(true);
  });

  it("falls back to the stored row id when an older persisted session has no runId", async () => {
    window.localStorage.setItem(
      "applican:resume-studio:active-run-session",
      JSON.stringify({
        requestId: "request-1",
        row: {
          id: "run-1",
          request_id: "request-1",
          user_id: "user-1",
          resume_path: "resume.pdf",
          resume_filename: "resume.pdf",
          job_description: "Software engineer",
          status: "extracting",
          error_code: null,
          error_message: null,
          output: null,
          created_at: "2026-04-16T00:00:00.000Z",
          updated_at: "2026-04-16T00:00:00.000Z",
        },
        phase: "extracting",
        progressMessage: "Waiting for extraction service...",
        progressPercent: 42,
        errorKind: null,
        errorMessage: "",
      }),
    );

    getResumeRunMock.mockResolvedValue(null);

    const { result } = renderHook(() => useCreateResumeRun());

    await act(async () => {
      await result.current.resumeStoredRun();
    });

    expect(getResumeRunMock).toHaveBeenCalledWith({ runId: "run-1" });
  });

  it("cancels an active run, deletes it, and clears persisted state", async () => {
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    const created = {
      requestId: "request-1",
      row: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: "queued",
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    };

    let releaseExtraction!: () => void;
    createResumeRunMock.mockResolvedValue(created);
    waitForRunExtractionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseExtraction = resolve;
        }),
    );
    deleteResumeRunMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCreateResumeRun());

    let submitPromise!: Promise<Awaited<ReturnType<typeof result.current.submitResumeRun>>>;

    await act(async () => {
      submitPromise = result.current.submitResumeRun({
        file,
        jobDescription: "Software engineer",
      });
      await Promise.resolve();
    });

    let cancelResult:
      | Awaited<ReturnType<typeof result.current.cancelActiveRun>>
      | undefined;

    await act(async () => {
      cancelResult = await result.current.cancelActiveRun();
    });

    await act(async () => {
      releaseExtraction();
      await submitPromise;
    });

    expect(deleteResumeRunMock).toHaveBeenCalledWith({ runId: "run-1" });
    expect(captureEventMock).toHaveBeenCalledWith("run_cancelled", {
      run_id: "run-1",
      request_id: "request-1",
    });
    expect(cancelResult).toEqual({ ok: true });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.hasPersistedRunState).toBe(false);
    expect(result.current.progressMessage).toBe("");
    expect(result.current.progressPercent).toBe(0);
    expect(window.localStorage.getItem("applican:resume-studio:active-run-session")).toBeNull();
  });
});
