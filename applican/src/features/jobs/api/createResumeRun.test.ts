import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  captureEventMock,
  insertResumeRunMock,
  uploadResumeToStorageMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  captureEventMock: vi.fn(),
  insertResumeRunMock: vi.fn(),
  uploadResumeToStorageMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
  },
}));

vi.mock("../../../posthog", () => ({
  captureEvent: captureEventMock,
}));

vi.mock("./insertResumeRun", () => ({
  insertResumeRun: insertResumeRunMock,
}));

vi.mock("./uploadResumeToStorage", () => ({
  uploadResumeToStorage: uploadResumeToStorageMock,
}));

import { RESUME_RUN_STATUS } from "../model/constants";
import { createResumeRun } from "./createResumeRun";

function createFile(contents = "resume", name = "resume.pdf") {
  return new File([contents], name, { type: "application/pdf" });
}

describe("createResumeRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("request-123");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when no resume file is provided", async () => {
    await expect(
      createResumeRun({
        file: null,
        jobDescription: "Software engineer role",
      }),
    ).rejects.toThrow("Please upload a resume file.");
  });

  it("rejects blank file names and empty job descriptions", async () => {
    await expect(
      createResumeRun({
        file: createFile("resume", " "),
        jobDescription: "Software engineer role",
      }),
    ).rejects.toThrow("Resume file name is missing.");

    await expect(
      createResumeRun({
        file: createFile(),
        jobDescription: "   ",
      }),
    ).rejects.toThrow("Please provide a job description.");
  });

  it("rejects when the authenticated user cannot be loaded", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "auth down" },
    });

    await expect(
      createResumeRun({
        file: createFile(),
        jobDescription: "Software engineer role",
      }),
    ).rejects.toThrow("Failed to fetch authenticated user: auth down");
  });

  it("creates a queued resume run after upload succeeds", async () => {
    const row = {
      id: "run-1",
      request_id: "request-123",
      user_id: "user-1",
      resume_path: "user-1/request-123-resume.pdf",
      resume_filename: "resume.pdf",
      job_description: "Software engineer role",
      status: RESUME_RUN_STATUS.QUEUED,
      error_code: null,
      error_message: null,
      output: null,
      created_at: "2026-04-16T00:00:00.000Z",
      updated_at: "2026-04-16T00:00:00.000Z",
    };

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    uploadResumeToStorageMock.mockResolvedValue({
      bucket: "Resumes",
      path: "user-1/request-123-resume.pdf",
      filename: "resume.pdf",
    });
    insertResumeRunMock.mockResolvedValue(row);

    const result = await createResumeRun({
      file: createFile(),
      jobDescription: "  Software engineer role  ",
    });

    expect(uploadResumeToStorageMock).toHaveBeenCalledWith({
      file: expect.any(File),
      userId: "user-1",
      requestId: "request-123",
    });
    expect(insertResumeRunMock).toHaveBeenCalledWith({
      request_id: "request-123",
      user_id: "user-1",
      resume_path: "user-1/request-123-resume.pdf",
      resume_filename: "resume.pdf",
      job_description: "Software engineer role",
      status: RESUME_RUN_STATUS.QUEUED,
      error_code: null,
      error_message: null,
      output: null,
    });
    expect(captureEventMock).toHaveBeenCalledWith("resume_upload_succeeded", {
      request_id: "request-123",
      file_name: "resume.pdf",
      file_size: 6,
    });
    expect(result).toEqual({
      requestId: "request-123",
      row,
    });
  });

  it("captures a failed upload event and rethrows the error", async () => {
    const uploadError = new Error("storage failed");

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    uploadResumeToStorageMock.mockRejectedValue(uploadError);

    await expect(
      createResumeRun({
        file: createFile(),
        jobDescription: "Software engineer role",
      }),
    ).rejects.toThrow("storage failed");

    expect(captureEventMock).toHaveBeenCalledWith("resume_upload_failed", {
      request_id: "request-123",
      file_name: "resume.pdf",
      file_size: 6,
      error_message: "storage failed",
    });
    expect(insertResumeRunMock).not.toHaveBeenCalled();
  });
});
