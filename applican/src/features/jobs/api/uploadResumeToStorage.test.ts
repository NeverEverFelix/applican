import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  uploadMock,
  fromMock,
} = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    storage: {
      from: fromMock,
    },
  },
}));

import { RESUME_BUCKET_NAME } from "../model/constants";
import { uploadResumeToStorage } from "./uploadResumeToStorage";

describe("uploadResumeToStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      upload: uploadMock,
    });
  });

  it("sanitizes the filename and uploads to the expected storage path", async () => {
    const file = new File(["resume"], "  Senior Resume (Final)!.pdf  ", {
      type: "application/pdf",
    });
    uploadMock.mockResolvedValue({ error: null });

    await expect(
      uploadResumeToStorage({
        file,
        userId: "user-1",
        requestId: "request-1",
      }),
    ).resolves.toEqual({
      bucket: RESUME_BUCKET_NAME,
      path: "user-1/request-1/Senior_Resume_Final.pdf",
      filename: "Senior_Resume_Final.pdf",
    });

    expect(fromMock).toHaveBeenCalledWith(RESUME_BUCKET_NAME);
    expect(uploadMock).toHaveBeenCalledWith(
      "user-1/request-1/Senior_Resume_Final.pdf",
      file,
      {
        contentType: "application/pdf",
        upsert: false,
      },
    );
  });

  it("surfaces upload failures", async () => {
    const file = new File(["resume"], "resume.pdf", {
      type: "application/pdf",
    });
    uploadMock.mockResolvedValue({
      error: { message: "bucket unavailable" },
    });

    await expect(
      uploadResumeToStorage({
        file,
        userId: "user-1",
        requestId: "request-1",
      }),
    ).rejects.toThrow("Failed to upload resume: bucket unavailable");
  });
});
