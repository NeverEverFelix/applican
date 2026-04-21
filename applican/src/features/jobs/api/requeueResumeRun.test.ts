import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  singleMock,
  selectMock,
  eqMock,
  updateMock,
  fromMock,
} = vi.hoisted(() => ({
  singleMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  updateMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { RESUME_RUN_STATUS, RESUME_RUNS_TABLE } from "../model/constants";
import { requeueResumeRun } from "./requeueResumeRun";

describe("requeueResumeRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ single: singleMock });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
  });

  it("rejects blank run ids", async () => {
    await expect(requeueResumeRun({ runId: "   " })).rejects.toThrow(
      "Failed to retry resume run: run id is required.",
    );
  });

  it("requeues the existing run", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "run-1",
        request_id: "request-1",
        user_id: "user-1",
        resume_path: "resume.pdf",
        resume_filename: "resume.pdf",
        job_description: "Software engineer",
        status: RESUME_RUN_STATUS.QUEUED,
        error_code: null,
        error_message: null,
        output: null,
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
      error: null,
    });

    const result = await requeueResumeRun({ runId: " run-1 " });

    expect(fromMock).toHaveBeenCalledWith(RESUME_RUNS_TABLE);
    expect(updateMock).toHaveBeenCalledWith({
      status: RESUME_RUN_STATUS.QUEUED,
      error_code: null,
      error_message: null,
    });
    expect(eqMock).toHaveBeenCalledWith("id", "run-1");
    expect(result).toEqual({
      requestId: "request-1",
      row: expect.objectContaining({
        id: "run-1",
        request_id: "request-1",
      }),
    });
  });

  it("surfaces database errors", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(requeueResumeRun({ runId: "run-1" })).rejects.toThrow(
      "Failed to retry resume run: permission denied",
    );
  });
});
