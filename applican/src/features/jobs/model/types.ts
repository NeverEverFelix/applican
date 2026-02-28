import type { RESUME_RUN_STATUS } from "./constants";

type ResumeRunStatus = (typeof RESUME_RUN_STATUS)[keyof typeof RESUME_RUN_STATUS];

export type ResumeRunInsert = {
  request_id: string;
  user_id: string;
  resume_path: string;
  resume_filename: string;
  job_description: string;
  status?: ResumeRunStatus;
  error_code?: string | null;
  error_message?: string | null;
  output?: unknown | null;
};

export type ResumeRunRow = ResumeRunInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type UploadResumeInput = {
  file: File;
  userId: string;
  requestId: string;
};

export type UploadResumeResult = {
  bucket: string;
  path: string;
  filename: string;
};

export type CreateResumeRunInput = {
  file: File | null;
  jobDescription: string;
};

export type CreateResumeRunResult = {
  requestId: string;
  row: ResumeRunRow;
};

export type GenerateBulletsInput = {
  runId: string;
  requestId: string;
};

export type GenerateBulletsResponse = {
  run: ResumeRunRow;
};
