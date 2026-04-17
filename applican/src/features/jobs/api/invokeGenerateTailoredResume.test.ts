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

import { invokeGenerateTailoredResume } from "./invokeGenerateTailoredResume";

describe("invokeGenerateTailoredResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a blank run id", async () => {
    await expect(
      invokeGenerateTailoredResume({ runId: "   ", requestId: "request-1" }),
    ).rejects.toThrow("Failed to compile LaTeX: run_id is required.");
  });

  it("invokes the edge function with trimmed values", async () => {
    const response = {
      run: { id: "run-1" },
      tailored_resume: {
        filename: "resume.tex",
        template: "jake",
        latex: "\\documentclass{}",
      },
    };

    invokeMock.mockResolvedValue({
      data: response,
      error: null,
    });

    await expect(
      invokeGenerateTailoredResume({ runId: " run-1 ", requestId: " request-1 " }),
    ).resolves.toEqual(response);

    expect(invokeMock).toHaveBeenCalledWith("generate-tailored-resume", {
      body: {
        run_id: "run-1",
        request_id: "request-1",
      },
    });
  });

  it("omits a blank request id from the payload", async () => {
    invokeMock.mockResolvedValue({
      data: {
        run: { id: "run-1" },
        tailored_resume: {
          filename: "resume.tex",
          template: "jake",
          latex: "\\documentclass{}",
        },
      },
      error: null,
    });

    await invokeGenerateTailoredResume({ runId: "run-1", requestId: "   " });

    expect(invokeMock).toHaveBeenCalledWith("generate-tailored-resume", {
      body: {
        run_id: "run-1",
        request_id: undefined,
      },
    });
  });

  it("maps known edge-function error codes", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "function failed",
        context: new Response(JSON.stringify({ error_code: "RUN_OUTPUT_MISSING" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      },
    });

    await expect(
      invokeGenerateTailoredResume({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow("Failed to compile LaTeX: generate analysis output first.");
  });

  it("maps unreachable function and payload error-message failures", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Failed to send a request to the Edge Function",
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "function failed",
          context: new Response(
            JSON.stringify({ error_message: "template generation failed" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          ),
        },
      })
      .mockResolvedValueOnce({
        data: {},
        error: null,
      });

    await expect(
      invokeGenerateTailoredResume({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow(
      "Failed to compile LaTeX: Edge Function unreachable. Deploy `generate-tailored-resume` and verify Supabase env values.",
    );

    await expect(
      invokeGenerateTailoredResume({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow("Failed to compile LaTeX: template generation failed");

    await expect(
      invokeGenerateTailoredResume({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow("Failed to compile LaTeX: invalid response from function.");
  });
});
