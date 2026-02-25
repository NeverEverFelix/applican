import { supabase } from "../../../lib/supabaseClient";
import type { GenerateBulletsInput, GenerateBulletsResponse } from "../model/types";

export async function invokeGenerateBullets(
  payload: GenerateBulletsInput,
): Promise<GenerateBulletsResponse> {
  const { data, error } = await supabase.functions.invoke("generate-bullets", {
    body: {
      run_id: payload.runId,
      resume_path: payload.resumePath,
      job_description: payload.jobDescription,
    },
  });

  if (error) {
    throw new Error(`Failed to generate bullets: ${error.message}`);
  }

  if (!data || typeof data !== "object" || !("run" in data)) {
    throw new Error("Failed to generate bullets: invalid response from function.");
  }

  return data as GenerateBulletsResponse;
}
