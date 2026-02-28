import { supabase } from "../../../lib/supabaseClient";
import { RESUME_RUN_STATUS } from "../model/constants";
import type { CreateResumeRunInput, CreateResumeRunResult } from "../model/types";
import { insertResumeRun } from "./insertResumeRun";
import { uploadResumeToStorage } from "./uploadResumeToStorage";

function validateCreateResumeRunInput({ file, jobDescription }: CreateResumeRunInput) {
  if (!file) {
    throw new Error("Please upload a resume file.");
  }

  if (!file.name.trim()) {
    throw new Error("Resume file name is missing.");
  }

  if (file.size <= 0) {
    throw new Error("Resume file appears to be empty.");
  }

  const normalizedJobDescription = jobDescription.trim();
  if (!normalizedJobDescription) {
    throw new Error("Please provide a job description.");
  }

  return { file, normalizedJobDescription };
}

export async function createResumeRun(
  input: CreateResumeRunInput,
): Promise<CreateResumeRunResult> {
  const { file, normalizedJobDescription } = validateCreateResumeRunInput(input);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Failed to fetch authenticated user: ${userError.message}`);
  }

  if (!user) {
    throw new Error("You must be logged in to submit a resume run.");
  }

  const requestId = crypto.randomUUID();
  const upload = await uploadResumeToStorage({
    file,
    userId: user.id,
    requestId,
  });

  const row = await insertResumeRun({
    request_id: requestId,
    user_id: user.id,
    resume_path: upload.path,
    resume_filename: upload.filename,
    job_description: normalizedJobDescription,
    status: RESUME_RUN_STATUS.QUEUED,
    error_code: null,
    error_message: null,
    output: null,
  });

  return {
    requestId,
    row,
  };
}
