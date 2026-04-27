import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  invokeMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { RESUME_RUN_STATUS } from "../model/constants";
import { enqueueResumeRunForGeneration } from "./enqueueResumeRunForGeneration";

describe("enqueueResumeRunForGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects blank run ids", async () => {
    await expect(enqueueResumeRunForGeneration({ runId: "   " })).rejects.toThrow(
      "Failed to enqueue resume run: run id is required.",
    );
  });

  it("queues an extracted run for generation and records queue time", async () => {
    invokeMock.mockResolvedValue({
      data: {
        run: {
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
      },
      error: null,
    });

    const result = await enqueueResumeRunForGeneration({ runId: " run-1 " });

    expect(invokeMock).toHaveBeenCalledWith("request-generation-enqueue", {
      body: {
        run_id: "run-1",
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: "run-1",
        request_id: "request-1",
      }),
    );
  });

  it("returns the existing run when no extracted row is updated", async () => {
    invokeMock.mockResolvedValue({
      data: {
        run: {
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

  it("surfaces function invocation errors", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error("Function unreachable"),
    });

    await expect(enqueueResumeRunForGeneration({ runId: "run-1" })).rejects.toThrow(
      "Failed to enqueue resume run: Function unreachable",
    );
  });
});
