import type { PdfRunContext } from "./queue.ts";

export type PreparedPdfInputs = {
  runId: string;
  requestId: string;
  userId: string;
  latex: string;
  filename: string;
};

export function preparePdfInputs(context: PdfRunContext): PreparedPdfInputs {
  const runId = context.run.id.trim();
  const requestId = context.run.request_id.trim();
  const userId = context.run.user_id.trim();
  const output = context.run.output && typeof context.run.output === "object"
    ? (context.run.output as Record<string, unknown>)
    : null;
  const tailoredResume = output?.tailored_resume && typeof output.tailored_resume === "object"
    ? (output.tailored_resume as Record<string, unknown>)
    : null;
  const latex = typeof tailoredResume?.latex === "string" ? tailoredResume.latex.trim() : "";
  const filename = typeof tailoredResume?.filename === "string" ? tailoredResume.filename.trim() : "";

  if (!runId) {
    throw new Error("Cannot prepare PDF inputs: run id is missing.");
  }

  if (!requestId) {
    throw new Error(`Cannot prepare PDF inputs for run ${runId}: request id is missing.`);
  }

  if (!userId) {
    throw new Error(`Cannot prepare PDF inputs for run ${runId}: user id is missing.`);
  }

  if (!tailoredResume) {
    throw new Error(`Cannot prepare PDF inputs for run ${runId}: tailored resume output is missing.`);
  }

  if (!latex) {
    throw new Error(`Cannot prepare PDF inputs for run ${runId}: latex is missing.`);
  }

  return {
    runId,
    requestId,
    userId,
    latex,
    filename: filename || "tailored-resume.tex",
  };
}
