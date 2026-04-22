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
    expect(result.current.errorMessage).toBe("worker offline");
    expect(result.current.createdRun).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(submitResult).toEqual({
      ok: false,
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

  it("resumes a persisted in-progress run and exposes the completed result", async () => {
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
