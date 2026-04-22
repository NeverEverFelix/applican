import { supabase } from "../../../lib/supabaseClient";
import { RESUME_RUNS_TABLE } from "../model/constants";

type DeleteResumeRunInput = {
  runId: string;
};

export async function deleteResumeRun({ runId }: DeleteResumeRunInput): Promise<void> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Failed to cancel resume run: run id is required.");
  }

  const { error } = await supabase.from(RESUME_RUNS_TABLE).delete().eq("id", normalizedRunId);

  if (error) {
    throw new Error(`Failed to cancel resume run: ${error.message}`);
  }
}
