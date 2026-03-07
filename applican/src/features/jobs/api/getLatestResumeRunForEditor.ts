import { supabase } from "../../../lib/supabaseClient";

type LatestRunRow = {
  id: string;
  request_id: string;
  output: unknown;
  created_at: string;
};

export async function getLatestResumeRunForEditor(): Promise<LatestRunRow | null> {
  const { data, error } = await supabase
    .from("resume_runs")
    .select("id, request_id, output, created_at")
    .not("output", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest resume run: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as LatestRunRow;
}
