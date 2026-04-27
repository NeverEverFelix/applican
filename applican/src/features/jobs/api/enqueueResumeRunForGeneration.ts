import { supabase } from "../../../lib/supabaseClient";
import type { ResumeRunRow } from "../model/types";

type EnqueueResumeRunForGenerationInput = {
  runId: string;
};

type RequestGenerationEnqueueResponse = {
  run?: unknown;
  error_code?: unknown;
  error_message?: unknown;
};

export async function enqueueResumeRunForGeneration({
  runId,
}: EnqueueResumeRunForGenerationInput): Promise<ResumeRunRow> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Failed to enqueue resume run: run id is required.");
  }

  const { data, error } = await supabase.functions.invoke("request-generation-enqueue", {
    body: {
      run_id: normalizedRunId,
    },
  });

  if (error) {
    const message = typeof error.message === "string" && error.message.trim()
      ? error.message
      : "Unknown function error.";
    throw new Error(`Failed to enqueue resume run: ${message}`);
  }

  const payload = data as RequestGenerationEnqueueResponse | null;
  if (!payload || typeof payload !== "object" || !("run" in payload) || !payload.run) {
    throw new Error("Failed to enqueue resume run: invalid response from function.");
  }

  return payload.run as ResumeRunRow;
}
