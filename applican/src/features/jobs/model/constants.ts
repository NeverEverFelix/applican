export const RESUME_BUCKET_NAME = "Resumes";
export const RESUME_RUNS_TABLE = "resume_runs";
export const RESUME_RUN_STATUS = {
  QUEUED: "queued",
  EXTRACTING: "extracting",
  EXTRACTED: "extracted",
  QUEUED_GENERATE: "queued_generate",
  GENERATING: "generating",
  QUEUED_PDF: "queued_pdf",
  COMPILING_PDF: "compiling_pdf",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export function isResumeRunPastExtraction(status: string): boolean {
  return (
    status === RESUME_RUN_STATUS.EXTRACTED ||
    status === RESUME_RUN_STATUS.QUEUED_GENERATE ||
    status === RESUME_RUN_STATUS.GENERATING ||
    status === RESUME_RUN_STATUS.QUEUED_PDF ||
    status === RESUME_RUN_STATUS.COMPILING_PDF ||
    status === RESUME_RUN_STATUS.COMPLETED
  );
}

export function isResumeRunTerminal(status: string): boolean {
  return status === RESUME_RUN_STATUS.COMPLETED || status === RESUME_RUN_STATUS.FAILED;
}
