import { supabase } from "../../../lib/supabaseClient";
import { RESUME_RUNS_TABLE } from "../model/constants";
import type { ResumeRunRow } from "../model/types";

type GetResumeRunInput = {
  runId: string;
};

export async function getResumeRun({ runId }: GetResumeRunInput): Promise<ResumeRunRow | null> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Failed to load resume run: run id is required.");
  }

  const { data, error } = await supabase.from(RESUME_RUNS_TABLE).select("*").eq("id", normalizedRunId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load resume run: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as ResumeRunRow;
}
