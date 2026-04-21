import { supabase } from "../../../lib/supabaseClient";
import { RESUME_RUN_STATUS, RESUME_RUNS_TABLE } from "../model/constants";
import type { CreateResumeRunResult } from "../model/types";

type RequeueResumeRunInput = {
  runId: string;
};

export async function requeueResumeRun({
  runId,
}: RequeueResumeRunInput): Promise<CreateResumeRunResult> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Failed to retry resume run: run id is required.");
  }

  const { data, error } = await supabase
    .from(RESUME_RUNS_TABLE)
    .update({
      status: RESUME_RUN_STATUS.QUEUED,
      error_code: null,
      error_message: null,
    })
    .eq("id", normalizedRunId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to retry resume run: ${error.message}`);
  }

  return {
    requestId: data.request_id,
    row: data,
  };
}
