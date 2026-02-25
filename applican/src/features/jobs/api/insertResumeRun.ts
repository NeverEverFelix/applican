import { supabase } from "../../../lib/supabaseClient";
import { RESUME_RUNS_TABLE } from "../model/constants";
import type { ResumeRunInsert, ResumeRunRow } from "../model/types";

export async function insertResumeRun(payload: ResumeRunInsert): Promise<ResumeRunRow> {
  const { data, error } = await supabase
    .from(RESUME_RUNS_TABLE)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create resume run: ${error.message}`);
  }

  return data as ResumeRunRow;
}
