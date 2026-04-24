import {
  buildLatexDocument,
  parseTailoredResumeInput,
  sanitizeNameForFile,
} from "./tailoredResume.ts";
import { JAKES_RESUME_TEMPLATE } from "./templates/jakesResumeTemplate.ts";

export type TailoredResumeExecutionResult = {
  filename: string;
  template: string;
  latex: string;
};

export function executeTailoredResume(params: {
  runOutput: unknown;
  resumeText: string;
}): TailoredResumeExecutionResult {
  const { runOutput, resumeText } = params;
  const tailoredInput = parseTailoredResumeInput(runOutput, resumeText);
  const latex = buildLatexDocument(tailoredInput, resumeText, JAKES_RESUME_TEMPLATE);
  const filename =
    `${sanitizeNameForFile(tailoredInput.target_company)}-${sanitizeNameForFile(tailoredInput.target_role)}.tex`;

  return {
    filename,
    template: "jakes-resume",
    latex,
  };
}
