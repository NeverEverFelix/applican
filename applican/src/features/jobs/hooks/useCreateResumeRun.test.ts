import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureExceptionMock,
  captureEventMock,
  createResumeRunMock,
  invokeGenerateBulletsMock,
  waitForRunExtractionMock,
} = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  captureEventMock: vi.fn(),
  createResumeRunMock: vi.fn(),
  invokeGenerateBulletsMock: vi.fn(),
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

vi.mock("../api/invokeGenerateBullets", () => ({
  invokeGenerateBullets: invokeGenerateBulletsMock,
}));

vi.mock("../api/waitForRunExtraction", () => ({
  waitForRunExtraction: waitForRunExtractionMock,
}));

import { useCreateResumeRun } from "./useCreateResumeRun";

describe("useCreateResumeRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
