import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  singleMock,
  eqMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => ({
  singleMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { RESUME_RUNS_TABLE, RESUME_RUN_STATUS } from "../model/constants";
import { waitForRunExtraction } from "./waitForRunExtraction";

describe("waitForRunExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ single: singleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects blank run ids", async () => {
    await expect(waitForRunExtraction({ runId: "   " })).rejects.toThrow(
      "Failed to check resume extraction: run id is required.",
    );
  });

  it("returns immediately when output is already present", async () => {
    singleMock.mockResolvedValue({
      data: {
        status: RESUME_RUN_STATUS.EXTRACTING,
        error_message: null,
        output: { text: "ready" },
      },
      error: null,
    });

    await expect(
      waitForRunExtraction({ runId: " run-1 ", pollIntervalMs: 1 }),
    ).resolves.toBeUndefined();

    expect(fromMock).toHaveBeenCalledWith(RESUME_RUNS_TABLE);
    expect(eqMock).toHaveBeenCalledWith("id", "run-1");
  });

  it("returns after the run reaches extracted status", async () => {
    vi.useFakeTimers();

    singleMock
      .mockResolvedValueOnce({
        data: {
          status: RESUME_RUN_STATUS.QUEUED,
          error_message: null,
          output: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          status: RESUME_RUN_STATUS.EXTRACTED,
          error_message: null,
          output: null,
        },
        error: null,
      });

    const promise = waitForRunExtraction({
      runId: "run-1",
      pollIntervalMs: 100,
      timeoutMs: 1_000,
      queuedTimeoutMs: 500,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
    expect(singleMock).toHaveBeenCalledTimes(2);
  });

  it("returns when the run has already advanced beyond extraction", async () => {
    singleMock.mockResolvedValue({
      data: {
        status: RESUME_RUN_STATUS.GENERATING,
        error_message: null,
        output: null,
      },
      error: null,
    });

    await expect(
      waitForRunExtraction({ runId: "run-1", pollIntervalMs: 1 }),
    ).resolves.toBeUndefined();
  });

  it("throws the run error when extraction fails", async () => {
    singleMock.mockResolvedValue({
      data: {
        status: RESUME_RUN_STATUS.FAILED,
        error_message: "pdf parsing failed",
        output: null,
      },
      error: null,
    });

    await expect(
      waitForRunExtraction({ runId: "run-1", pollIntervalMs: 1 }),
    ).rejects.toThrow("pdf parsing failed");
  });

  it("throws a queued timeout when the run never leaves queued", async () => {
    vi.useFakeTimers();

    singleMock.mockResolvedValue({
      data: {
        status: RESUME_RUN_STATUS.QUEUED,
        error_message: null,
        output: null,
      },
      error: null,
    });

    const expectation = expect(
      waitForRunExtraction({
      runId: "run-1",
      pollIntervalMs: 100,
      timeoutMs: 5_000,
      queuedTimeoutMs: 150,
      }),
    ).rejects.toThrow(
      "Resume is still queued. Extraction service may be offline. Start the extractor service, then try again.",
    );

    await vi.runAllTimersAsync();
    await expectation;
  });
});
