import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  limitMock,
  orderMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => ({
  limitMock: vi.fn(),
  orderMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { listGeneratedResumes } from "./listGeneratedResumes";

describe("listGeneratedResumes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderMock.mockReturnValue({ limit: limitMock });
    selectMock.mockReturnValue({ order: orderMock });
    fromMock.mockReturnValue({ select: selectMock });
  });

  it("loads generated resumes with a clamped limit", async () => {
    const rows = [
      {
        id: "resume-1",
        run_id: "run-1",
        request_id: "request-1",
        template: "jake",
        filename: "resume.tex",
        latex: "\\documentclass{}",
        created_at: "2026-04-17T00:00:00.000Z",
        updated_at: "2026-04-17T00:00:00.000Z",
      },
    ];
    limitMock.mockResolvedValue({
      data: rows,
      error: null,
    });

    await expect(listGeneratedResumes(500)).resolves.toEqual(rows);

    expect(fromMock).toHaveBeenCalledWith("generated_resumes");
    expect(limitMock).toHaveBeenCalledWith(100);
  });

  it("returns an empty array for non-array data", async () => {
    limitMock.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(listGeneratedResumes(0)).resolves.toEqual([]);
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it("surfaces query errors", async () => {
    limitMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(listGeneratedResumes()).rejects.toThrow(
      "Failed to load generated resumes: permission denied",
    );
  });
});
