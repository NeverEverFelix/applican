import type { GenerationRunContext } from "./queue.ts";

export type PreparedGenerationInputs = {
  runId: string;
  requestId: string;
  userId: string;
  jobDescription: string;
  resumeText: string;
  existingOutput: unknown;
};

export function prepareGenerationInputs(context: GenerationRunContext): PreparedGenerationInputs {
  const runId = context.run.id.trim();
  const requestId = context.run.request_id.trim();
  const userId = context.run.user_id.trim();
  const jobDescription = context.run.job_description.trim();
  const resumeText = context.resumeDocument?.text.trim() ?? "";

  if (!runId) {
    throw new Error("Cannot prepare generation inputs: run id is missing.");
  }

  if (!requestId) {
    throw new Error(`Cannot prepare generation inputs for run ${runId}: request id is missing.`);
  }

  if (!userId) {
    throw new Error(`Cannot prepare generation inputs for run ${runId}: user id is missing.`);
  }

  if (!jobDescription) {
    throw new Error(`Cannot prepare generation inputs for run ${runId}: job description is missing.`);
  }

  if (!resumeText) {
    throw new Error(`Cannot prepare generation inputs for run ${runId}: extracted resume text is missing.`);
  }

  return {
    runId,
    requestId,
    userId,
    jobDescription,
    resumeText,
    existingOutput: context.run.output ?? null,
  };
}
