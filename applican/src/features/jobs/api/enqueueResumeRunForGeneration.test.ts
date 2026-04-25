import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  maybeSingleMock,
  singleMock,
  selectExistingEqMock,
  selectMock,
  eqGenerateStatusMock,
  eqRunIdMock,
  updateMock,
  fromMock,
} = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  singleMock: vi.fn(),
  selectExistingEqMock: vi.fn(),
  selectMock: vi.fn(),
  eqGenerateStatusMock: vi.fn(),
  eqRunIdMock: vi.fn(),
  updateMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { RESUME_RUN_STATUS, RESUME_RUNS_TABLE } from "../model/constants";
import { enqueueResumeRunForGeneration } from "./enqueueResumeRunForGeneration";

describe("enqueueResumeRunForGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqGenerateStatusMock.mockReturnValue({ select: selectMock });
    eqRunIdMock.mockReturnValue({ eq: eqGenerateStatusMock });
    selectExistingEqMock.mockReturnValue({ single: singleMock });
    selectMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    updateMock.mockReturnValue({ eq: eqRunIdMock });
    fromMock.mockReturnValue({
      update: updateMock,
      select: vi.fn(() => ({ eq: selectExistingEqMock })),
    });
  });

  it("rejects blank run ids", async () => {
    await expect(enqueueResumeRunForGeneration({ runId: "   " })).rejects.toThrow(
      "Failed to enqueue resume run: run id is required.",
    );
  });

  it("queues an extracted run for generation and records queue time", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: RESUME_RUN_STATUS.QUEUED_GENERATE,
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
      error: null,
    });

    const result = await enqueueResumeRunForGeneration({ runId: " run-1 " });

    expect(fromMock).toHaveBeenCalledWith(RESUME_RUNS_TABLE);
    expect(updateMock).toHaveBeenCalledWith({
      status: RESUME_RUN_STATUS.QUEUED_GENERATE,
      generation_queued_at: expect.any(String),
      error_code: null,
      error_message: null,
    });
    expect(eqRunIdMock).toHaveBeenCalledWith("id", "run-1");
    expect(eqGenerateStatusMock).toHaveBeenCalledWith("status", RESUME_RUN_STATUS.EXTRACTED);
    expect(result).toEqual(
      expect.objectContaining({
        id: "run-1",
        request_id: "request-1",
      }),
    );
  });

  it("returns the existing run when no extracted row is updated", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    singleMock.mockResolvedValue({
      data: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: RESUME_RUN_STATUS.GENERATING,
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
      error: null,
    });

    const result = await enqueueResumeRunForGeneration({ runId: "run-1" });

    expect(result).toEqual(
      expect.objectContaining({
        id: "run-1",
        status: RESUME_RUN_STATUS.GENERATING,
      }),
    );
  });
});
