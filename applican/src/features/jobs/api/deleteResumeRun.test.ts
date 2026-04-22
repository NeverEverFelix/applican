import { beforeEach, describe, expect, it, vi } from "vitest";

const { eqMock, deleteMock, fromMock } = vi.hoisted(() => ({
  eqMock: vi.fn(),
  deleteMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { RESUME_RUNS_TABLE } from "../model/constants";
import { deleteResumeRun } from "./deleteResumeRun";

describe("deleteResumeRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ delete: deleteMock });
  });

  it("rejects blank run ids", async () => {
    await expect(deleteResumeRun({ runId: "   " })).rejects.toThrow(
      "Failed to cancel resume run: run id is required.",
    );
  });

  it("deletes the existing run", async () => {
    eqMock.mockResolvedValue({ error: null });

    await expect(deleteResumeRun({ runId: " run-1 " })).resolves.toBeUndefined();

    expect(fromMock).toHaveBeenCalledWith(RESUME_RUNS_TABLE);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("id", "run-1");
  });

  it("surfaces database errors", async () => {
    eqMock.mockResolvedValue({
      error: { message: "permission denied" },
    });

    await expect(deleteResumeRun({ runId: "run-1" })).rejects.toThrow(
      "Failed to cancel resume run: permission denied",
    );
  });
});
