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

import { invokeCompileTailoredResumePdf } from "./invokeCompileTailoredResumePdf";

describe("invokeCompileTailoredResumePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects blank latex input", async () => {
    await expect(
      invokeCompileTailoredResumePdf({ latex: "   ", filename: "resume.tex" }),
    ).rejects.toThrow("Failed to compile PDF: editor is empty.");
  });

  it("invokes the edge function with trimmed values", async () => {
    invokeMock.mockResolvedValue({
      data: { signed_url: "https://example.com/resume.pdf" },
      error: null,
    });

    await expect(
      invokeCompileTailoredResumePdf({ latex: " \\documentclass{} ", filename: " resume.tex " }),
    ).resolves.toEqual({ signed_url: "https://example.com/resume.pdf" });

    expect(invokeMock).toHaveBeenCalledWith("compile-tailored-resume-pdf", {
      body: {
        latex: "\\documentclass{}",
        filename: "resume.tex",
      },
    });
  });

  it("maps edge function errors and invalid responses", async () => {
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
          message: "compile failed",
          context: new Response(
            JSON.stringify({ error_code: "LATEX_COMPILE_FAILED", error_message: "missing package", compile_log: "log output" }),
            {
              status: 400,
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
      invokeCompileTailoredResumePdf({ latex: "\\documentclass{}", filename: "resume.tex" }),
    ).rejects.toThrow(
      "Failed to compile PDF: Edge Function unreachable. Deploy `compile-tailored-resume-pdf` and verify Supabase env values.",
    );

    await expect(
      invokeCompileTailoredResumePdf({ latex: "\\documentclass{}", filename: "resume.tex" }),
    ).rejects.toMatchObject({
      message: "Failed to compile PDF (LATEX_COMPILE_FAILED): missing package",
      errorCode: "LATEX_COMPILE_FAILED",
      compileLog: "log output",
    });

    await expect(
      invokeCompileTailoredResumePdf({ latex: "\\documentclass{}", filename: "resume.tex" }),
    ).rejects.toThrow("Failed to compile PDF: invalid function response.");
  });
});
