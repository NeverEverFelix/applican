import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { getResumeDownloadUrl } from "./getResumeDownloadUrl";

describe("getResumeDownloadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the signed url payload on success", async () => {
    const response = {
      signed_url: "https://example.com/resume.pdf",
      filename: "resume.pdf",
    };

    invokeMock.mockResolvedValue({
      data: response,
      error: null,
    });

    await expect(getResumeDownloadUrl("app-1")).resolves.toEqual(response);

    expect(invokeMock).toHaveBeenCalledWith("get-resume-download-url", {
      body: {
        application_id: "app-1",
      },
    });
  });

  it("maps unreachable edge function errors", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "Failed to send a request to the Edge Function",
      },
    });

    await expect(getResumeDownloadUrl("app-1")).rejects.toThrow(
      "Edge Function unreachable. Deploy `get-resume-download-url`, verify VITE_SUPABASE_URL points to that project, and confirm the function is active.",
    );
  });

  it("surfaces raw function errors and invalid payloads", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "application not found",
        },
      })
      .mockResolvedValueOnce({
        data: { filename: "resume.pdf" },
        error: null,
      });

    await expect(getResumeDownloadUrl("app-1")).rejects.toThrow(
      "Failed to fetch download URL: application not found",
    );

    await expect(getResumeDownloadUrl("app-1")).rejects.toThrow(
      "Failed to fetch download URL: invalid function response.",
    );
  });
});
