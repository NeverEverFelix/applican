export const RESUME_BUCKET_NAME = "Resumes";
export const RESUME_RUNS_TABLE = "resume_runs";
export const RESUME_RUN_STATUS = {
  QUEUED: "queued",
  EXTRACTING: "extracting",
  EXTRACTED: "extracted",
  FAILED: "failed",
} as const;
