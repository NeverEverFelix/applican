import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  rangeMock,
  orderMock,
  inMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => ({
  rangeMock: vi.fn(),
  orderMock: vi.fn(),
  inMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { listHistoryCards } from "./listHistoryCards";

describe("listHistoryCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps history rows into card data, links applications, and reports hasMore", async () => {
    const analysisRows = [
      {
        run_id: "run-1",
        company: "Acme",
        job_title: "Product Designer",
        location: "Remote",
        industry: "Design",
        experience_needed: "5 years",
        job_type: "remote",
        score: 91.6,
        analysis_summary: "Strong match",
        created_at: "2026-04-10T12:00:00.000Z",
      },
      {
        run_id: "run-2",
        company: "",
        job_title: "",
        location: "unknown",
        industry: "",
        experience_needed: "",
        job_type: "field",
        score: 140,
        analysis_summary: "",
        created_at: "invalid-date",
      },
      {
        run_id: "run-3",
        company: "Extra",
        job_title: "Ignored",
        location: "NYC",
        industry: "Tech",
        experience_needed: "3 years",
        job_type: "hybrid",
        score: 70,
        analysis_summary: "Extra row",
        created_at: "2026-04-09T12:00:00.000Z",
      },
    ];

    const applicationRows = [
      {
        id: "app-1",
        source_resume_run_id: "run-1",
        date_applied: "2026-04-12T12:00:00.000Z",
        resume_filename: "resume-v1.pdf",
      },
      {
        id: "app-2",
        source_resume_run_id: "run-2",
        date_applied: null,
        resume_filename: null,
      },
    ];

    rangeMock.mockResolvedValue({
      data: analysisRows,
      error: null,
    });
    inMock.mockResolvedValue({
      data: applicationRows,
      error: null,
    });

    orderMock.mockReturnValue({ range: rangeMock });
    selectMock
      .mockImplementationOnce(() => ({ order: orderMock }))
      .mockImplementationOnce(() => ({ in: inMock }));
    fromMock
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }));

    const result = await listHistoryCards(2, 0);

    expect(result.hasMore).toBe(true);
    expect(result.cards).toEqual([
      {
        historyEntryId: "run-1",
        resumeRunId: "run-1",
        role: "Product Designer",
        company: "Acme",
        location: "Remote",
        industry: "Design",
        createdAt: "Apr 10, 2026",
        appliedAt: "Apr 12, 2026",
        submittedAtIso: "2026-04-10T12:00:00.000Z",
        score: 92,
        experienceNeeded: "5 years",
        jobType: "Remote",
        analysisSummary: "Strong match",
        sourceApplicationId: "app-1",
        resumeFilename: "resume-v1.pdf",
      },
      {
        historyEntryId: "run-2",
        resumeRunId: "run-2",
        role: "Target Role",
        company: "Unknown Company",
        location: "Location: N/A",
        industry: "Not specified",
        createdAt: "invalid-date",
        appliedAt: "---",
        submittedAtIso: "invalid-date",
        score: 100,
        experienceNeeded: "Not specified",
        jobType: "Unknown",
        analysisSummary: "No analysis summary available.",
        sourceApplicationId: "app-2",
        resumeFilename: undefined,
      },
    ]);

    expect(fromMock).toHaveBeenNthCalledWith(1, "analysis_runs");
    expect(fromMock).toHaveBeenNthCalledWith(2, "applications");
  });

  it("falls back when the industry column is missing", async () => {
    rangeMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "column analysis_runs.industry does not exist" },
      })
      .mockResolvedValueOnce({
        data: [
          {
            run_id: "run-1",
            company: "Acme",
            job_title: "Designer",
            location: "Remote",
            experience_needed: "5 years",
            job_type: "remote",
            score: 80,
            analysis_summary: "Strong match",
            created_at: "2026-04-10T12:00:00.000Z",
          },
        ],
        error: null,
      });

    inMock.mockResolvedValue({ data: [], error: null });
    orderMock.mockReturnValue({ range: rangeMock });
    selectMock
      .mockImplementationOnce(() => ({ order: orderMock }))
      .mockImplementationOnce(() => ({ order: orderMock }))
      .mockImplementationOnce(() => ({ in: inMock }));
    fromMock
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }));

    const result = await listHistoryCards(20, 0);

    expect(result.cards[0]?.industry).toBe("Not specified");
  });

  it("throws when the history query fails", async () => {
    rangeMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    orderMock.mockReturnValue({ range: rangeMock });
    selectMock.mockImplementation(() => ({ order: orderMock }));
    fromMock.mockImplementation(() => ({ select: selectMock }));

    await expect(listHistoryCards()).rejects.toThrow(
      "Failed to load history: permission denied",
    );
  });

  it("throws when loading linked applications fails", async () => {
    rangeMock.mockResolvedValue({
      data: [
        {
          run_id: "run-1",
          company: "Acme",
          job_title: "Designer",
          location: "Remote",
          industry: "Design",
          experience_needed: "5 years",
          job_type: "remote",
          score: 80,
          analysis_summary: "Strong match",
          created_at: "2026-04-10T12:00:00.000Z",
        },
      ],
      error: null,
    });
    inMock.mockResolvedValue({
      data: null,
      error: { message: "applications unavailable" },
    });

    orderMock.mockReturnValue({ range: rangeMock });
    selectMock
      .mockImplementationOnce(() => ({ order: orderMock }))
      .mockImplementationOnce(() => ({ in: inMock }));
    fromMock
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }));

    await expect(listHistoryCards()).rejects.toThrow(
      "Failed to load history resumes: applications unavailable",
    );
  });
});
