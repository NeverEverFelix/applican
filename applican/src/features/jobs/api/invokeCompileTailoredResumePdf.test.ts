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

  it("rejects empty latex input", async () => {
    await expect(
      invokeCompileTailoredResumePdf({ latex: "   ", filename: "resume.tex" }),
    ).rejects.toMatchObject({
      message: "Failed to compile PDF: editor is empty.",
    });
  });

  it("invokes the compile function with trimmed latex and fallback filename", async () => {
    const response = { signed_url: "https://example.com/file.pdf" };

    invokeMock.mockResolvedValue({
      data: response,
      error: null,
    });

    await expect(
      invokeCompileTailoredResumePdf({ latex: "  \\section{Experience}  ", filename: "   ", runId: " run-1 " }),
    ).resolves.toEqual(response);

    expect(invokeMock).toHaveBeenCalledWith("compile-tailored-resume-pdf", {
      body: {
        latex: "\\section{Experience}",
        filename: "tailored-resume.tex",
        run_id: "run-1",
      },
    });
  });

  it("returns compile metadata on structured backend errors", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "function failed",
        context: new Response(
          JSON.stringify({
            error_code: "LATEX_COMPILE_FAILED",
            error_message: "Undefined control sequence",
            compile_log: "l.12 Undefined control sequence",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    await expect(
      invokeCompileTailoredResumePdf({ latex: "\\section{Experience}", filename: "resume.tex" }),
    ).rejects.toMatchObject({
      message: "Failed to compile PDF (LATEX_COMPILE_FAILED): Undefined control sequence",
      errorCode: "LATEX_COMPILE_FAILED",
      compileLog: "l.12 Undefined control sequence",
    });
  });

  it("maps unreachable edge-function failures", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "Failed to send a request to the Edge Function",
      },
    });

    await expect(
      invokeCompileTailoredResumePdf({ latex: "\\section{Experience}", filename: "resume.tex" }),
    ).rejects.toMatchObject({
      message:
        "Failed to compile PDF: Edge Function unreachable. Deploy `compile-tailored-resume-pdf` and verify Supabase env values.",
    });
  });

  it("attaches compile logs to invalid responses", async () => {
    invokeMock.mockResolvedValue({
      data: {
        compile: {
          compile_log: "missing \\begin{document}",
        },
      },
      error: null,
    });

    await expect(
      invokeCompileTailoredResumePdf({ latex: "\\section{Experience}", filename: "resume.tex" }),
    ).rejects.toMatchObject({
      message: "Failed to compile PDF: invalid function response.",
      compileLog: "missing \\begin{document}",
    });
  });
});
