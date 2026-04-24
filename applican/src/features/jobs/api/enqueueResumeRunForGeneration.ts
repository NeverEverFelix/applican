import { supabase } from "../../../lib/supabaseClient";
import { RESUME_RUN_STATUS, RESUME_RUNS_TABLE } from "../model/constants";
import type { ResumeRunRow } from "../model/types";

type EnqueueResumeRunForGenerationInput = {
  runId: string;
};

export async function enqueueResumeRunForGeneration({
  runId,
}: EnqueueResumeRunForGenerationInput): Promise<ResumeRunRow> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Failed to enqueue resume run: run id is required.");
  }

  const { data: updated, error: updateError } = await supabase
    .from(RESUME_RUNS_TABLE)
    .update({
      status: RESUME_RUN_STATUS.QUEUED_GENERATE,
      error_code: null,
      error_message: null,
    })
    .eq("id", normalizedRunId)
    .eq("status", RESUME_RUN_STATUS.EXTRACTED)
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to enqueue resume run: ${updateError.message}`);
  }

  if (updated) {
    return updated as ResumeRunRow;
  }

  const { data: existing, error: existingError } = await supabase
    .from(RESUME_RUNS_TABLE)
    .select("*")
    .eq("id", normalizedRunId)
    .single();

  if (existingError || !existing) {
    throw new Error(`Failed to load resume run after enqueue attempt: ${existingError?.message ?? "Run not found."}`);
  }

  return existing as ResumeRunRow;
}
