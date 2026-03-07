import { supabase } from "../../../lib/supabaseClient";
import type { GeneratedResumeRow } from "../model/types";

export async function listGeneratedResumes(limit = 20): Promise<GeneratedResumeRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const { data, error } = await supabase
    .from("generated_resumes")
    .select("id, run_id, request_id, template, filename, latex, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to load generated resumes: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data as GeneratedResumeRow[];
}
