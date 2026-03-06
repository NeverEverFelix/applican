import { supabase } from "../../../lib/supabaseClient";
import type { GenerateBulletsInput, GenerateBulletsResponse } from "../model/types";

type EdgeFunctionErrorPayload = {
  error_code?: unknown;
  error_message?: unknown;
};

async function toGenerateBulletsErrorMessage(error: unknown): Promise<string> {
  const fallback = "Failed to generate bullets.";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const rawMessage = "message" in error && typeof error.message === "string" ? error.message : "";
  if (rawMessage.includes("Failed to send a request to the Edge Function")) {
    return "Failed to generate bullets: Edge Function unreachable. Deploy `generate-bullets` and verify Supabase env values.";
  }

  const context = "context" in error ? error.context : null;
  if (context instanceof Response) {
    const payload = (await context
      .clone()
      .json()
      .catch(() => null)) as EdgeFunctionErrorPayload | null;
    const errorCode = typeof payload?.error_code === "string" ? payload.error_code : "";
    const errorMessage = typeof payload?.error_message === "string" ? payload.error_message : "";

    if (errorCode === "RUN_NOT_READY" || errorCode === "RESUME_NOT_EXTRACTED") {
      return "Failed to generate bullets: Resume is still being extracted. Wait a few seconds, then try again.";
    }

    if (errorCode === "RUN_TERMINAL") {
      return "Failed to generate bullets: This run is marked failed. Re-upload the resume to start a new run.";
    }

    if (errorCode === "REQUEST_ID_MISMATCH") {
      return "Failed to generate bullets: Stale request id for this run. Start a new analysis.";
    }

    if (errorCode === "FREE_PLAN_LIMIT_REACHED" || errorCode === "ANALYSIS_LIMIT_REACHED") {
      return "Free plan limit reached: you have used all 5 analyses. Upgrade to continue.";
    }

    if (errorMessage) {
      return `Failed to generate bullets: ${errorMessage}`;
    }

    if (rawMessage.trim()) {
      return `Failed to generate bullets: ${rawMessage}`;
    }

    return `${fallback} HTTP ${context.status}.`;
  }

  return rawMessage.trim() ? `Failed to generate bullets: ${rawMessage}` : fallback;
}

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
    throw new Error(await toGenerateBulletsErrorMessage(error));
  }

  if (!data || typeof data !== "object" || !("run" in data)) {
    throw new Error("Failed to generate bullets: invalid response from function.");
  }

  return data as GenerateBulletsResponse;
}
