import { supabase } from "../../../lib/supabaseClient";
import type { GenerateBulletsInput, GenerateBulletsResponse } from "../model/types";

export async function invokeGenerateBullets(
  payload: GenerateBulletsInput,
): Promise<GenerateBulletsResponse> {
  const runId = payload.runId.trim();
  const requestId = payload.requestId.trim();
  if (!runId || !requestId) {
    throw new Error("Failed to generate bullets: run_id and request_id are required.");
  }

  const { data, error } = await supabase.functions.invoke("generate-bullets", {
    body: {
      run_id: runId,
      request_id: requestId,
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
